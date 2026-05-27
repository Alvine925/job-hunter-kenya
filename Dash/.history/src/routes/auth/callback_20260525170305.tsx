import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearOnboardingCache, ensureAuthSessionReady, persistSessionToStorage } from "@/lib/auth-session";
import {
  clearUserScopedQueries,
  prefetchMarketplaceQueries,
} from "@/lib/marketplace-prefetch";
import { queryClient } from "@/lib/query-client";
import { AuthFlowOverlay } from "@/components/auth/auth-flow-overlay";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallback });

function AuthCallback() {
  const navigate = useNavigate();
  const processed = useRef(false);
  const search = useSearch({ from: "/auth/callback" }) as {
    access_token?: string;
    refresh_token?: string;
    google_access_token?: string;
    google_refresh_token?: string;
    ref?: string;
    error?: string;
  };

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const handleCallback = async () => {
      try {
        if (search.error) {
          toast.error("Authentication failed: " + search.error);
          navigate({ to: "/login", replace: true });
          return;
        }

        if (search.access_token) {
          const { error } = await supabase.auth.setSession({
            access_token: search.access_token,
            refresh_token: search.refresh_token || "",
          });
          if (error) throw error;

          // Persist session to localStorage
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            persistSessionToStorage(session);
          }

          if (search.google_access_token) {
            try {
              const { data: user } = await supabase.auth.getUser();
              if (user.user) {
                await supabase.from("user_integrations").upsert({
                  user_id: user.user.id,
                  google_access_token: search.google_access_token,
                  google_refresh_token: search.google_refresh_token || "",
                  google_connected: true,
                  updated_at: new Date().toISOString(),
                });
                clearOnboardingCache();
              }
            } catch (err) {
              console.warn("Failed to store Google tokens:", err);
            }
          }
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const sessionUser =
          userData.user ?? (await supabase.auth.getSession()).data.session?.user;
        if (!sessionUser) {
          navigate({ to: "/login", replace: true });
          return;
        }

        // Claim referral code if present
        const refCode = search.ref || localStorage.getItem("referral_code");
        if (refCode) {
          try {
            console.log(`[Referral] Attempting to claim referral with code: ${refCode}`);
            const { error: rpcError } = await supabase.rpc("claim_referral", {
              ref_code: refCode,
            });
            if (rpcError) {
              console.warn("[Referral] Failed to claim referral via RPC:", rpcError);
            } else {
              console.log("[Referral] Claimed referral successfully via RPC");
              localStorage.removeItem("referral_code");
            }
          } catch (rpcErr) {
            console.warn("[Referral] Error invoking claim_referral RPC:", rpcErr);
          }
        }

        await ensureAuthSessionReady();
        clearUserScopedQueries(queryClient);
        // Warm the cache in the background — don't block navigation on it.
        void prefetchMarketplaceQueries(queryClient);
        navigate({ to: "/marketplace", replace: true });
      } catch (error: unknown) {
        console.error("Auth callback error:", error);
        toast.error(
          "Authentication failed: " + (error instanceof Error ? error.message : "Unknown error"),
        );
        navigate({ to: "/login", replace: true });
      }
    };

    void handleCallback();
  }, []);

  return <AuthFlowOverlay message="Finishing sign in…" />;
}
