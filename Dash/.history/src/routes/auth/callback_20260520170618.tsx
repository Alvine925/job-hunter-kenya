import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
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
    error?: string;
  };

  useEffect(() => {
    // Prevent double execution
    if (processed.current) return;
    processed.current = true;

    const handleCallback = async () => {
      try {
        // Handle errors
        if (search.error) {
          toast.error("Authentication failed: " + search.error);
          navigate({ to: "/login" });
          return;
        }

        // If we have tokens from the edge function, set the session
        if (search.access_token) {
          console.log("Setting session with tokens from edge function");
          
          const { error } = await supabase.auth.setSession({
            access_token: search.access_token,
            refresh_token: search.refresh_token || "",
          });

          if (error) {
            throw error;
          }

          // Store Google tokens if available
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
              }
            } catch (err) {
              console.warn("Failed to store Google tokens:", err);
              // Continue even if this fails
            }
          }

          // Get user info
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userError) throw userError;

          if (userData.user) {
            console.log("User authenticated:", userData.user.id);
            
            // Check if user has completed CV upload
            const { data: prof, error: profError } = await supabase
              .from("profiles")
              .select("cv_storage_path")
              .eq("id", userData.user.id)
              .maybeSingle();

            if (profError) {
              console.warn("Error fetching profile:", profError);
              // Continue to onboarding if we can't determine CV status
              navigate({ to: "/integrations" });
              return;
            }

            if (prof?.cv_storage_path) {
              console.log("CV found, redirecting to find-jobs");
              navigate({ to: "/find-jobs" });
            } else {
              console.log("No CV found, redirecting to integrations");
              navigate({ to: "/integrations" });
            }
          }
        } else {
          // No tokens in URL, check if already authenticated
          console.log("No tokens in URL, checking session");
          
          const { data, error } = await supabase.auth.getSession();

          if (error) throw error;

          if (data.session) {
            console.log("Session exists, checking CV");
            
            const { data: prof } = await supabase
              .from("profiles")
              .select("cv_storage_path")
              .eq("id", data.session.user.id)
              .maybeSingle();

            if (prof?.cv_storage_path) {
              navigate({ to: "/find-jobs" });
            } else {
              navigate({ to: "/integrations" });
            }
          } else {
            console.log("No session, redirecting to login");
            navigate({ to: "/login" });
          }
        }
      } catch (error: any) {
        console.error("Auth callback error:", error);
        toast.error("Authentication failed: " + error.message);
        navigate({ to: "/login" });
      }
    };

    handleCallback();
  }, []); // Only run once on mount

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Processing authentication...</p>
    </div>
  );
}
