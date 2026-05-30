import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  clearOnboardingCache,
  ensureAuthSessionReady,
  persistSessionToStorage,
} from "@/lib/auth-session";
import { clearUserScopedQueries, prefetchMarketplaceQueries } from "@/lib/marketplace-prefetch";
import { queryClient } from "@/lib/query-client";
import { AuthFlowOverlay } from "@/components/auth/auth-flow-overlay";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallback });

const POST_LOGIN_WELCOME_KEY = "tellus_show_welcome_after_login";

function AuthCallback() {
  const navigate = useNavigate();
  const processed = useRef(false);
  const search = useSearch({ from: "/auth/callback" }) as {
    session_key?: string;
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

        let returnedRef: string | undefined;

        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const hasHashToken = window.location.hash.includes("access_token");

        if (code) {
          // Native Supabase authorization code exchange
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (data.session) {
            persistSessionToStorage(data.session);
          }
        } else if (hasHashToken) {
          // Native Supabase hash fragment session (magic link recovery/invite)
          const session = await ensureAuthSessionReady();
          if (!session) throw new Error("Failed to initialize session from URL link");
        } else if (search.session_key) {
          // Exchange custom session key for tokens securely via POST
          const res = await fetch("/api/auth/exchange-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_key: search.session_key }),
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || "Failed to exchange session key");
          }

          const data = await res.json();
          const {
            access_token,
            refresh_token,
            google_access_token,
            google_refresh_token,
            ref: sessionRef,
          } = data;
          returnedRef = sessionRef;

          if (access_token) {
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token: refresh_token || "",
            });
            if (error) throw error;

            // Persist session to localStorage
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session) {
              persistSessionToStorage(session);
            }

            if (google_access_token) {
              try {
                const { data: user } = await supabase.auth.getUser();
                if (user.user) {
                  await supabase.from("user_integrations").upsert({
                    user_id: user.user.id,
                    google_access_token,
                    google_refresh_token: google_refresh_token || "",
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
        } else {
          toast.error("Authentication failed: Missing session key or login link");
          navigate({ to: "/login", replace: true });
          return;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const sessionUser = userData.user ?? (await supabase.auth.getSession()).data.session?.user;
        if (!sessionUser) {
          navigate({ to: "/login", replace: true });
          return;
        }

        // Claim referral code if present
        const refCode = search.ref || returnedRef || localStorage.getItem("referral_code");
        if (refCode) {
          try {
            console.log(`[Referral] Attempting to claim referral with code: ${refCode}`);
            const { error: rpcError } = await (supabase.rpc as any)("claim_referral", {
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
        sessionStorage.setItem(POST_LOGIN_WELCOME_KEY, "true");
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
  }, [
    navigate,
    search.session_key,
    search.error,
    search.ref,
  ]);

  return <AuthFlowOverlay message="Finishing sign in…" />;
}
