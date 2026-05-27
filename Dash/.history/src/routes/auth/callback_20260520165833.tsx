import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallback });

function AuthCallback() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/callback" }) as {
    access_token?: string;
    refresh_token?: string;
    google_access_token?: string;
    google_refresh_token?: string;
    error?: string;
  };

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Handle errors
        if (search.error) {
          throw new Error(search.error);
        }

        // If we have tokens from the edge function, set the session
        if (search.access_token) {
          const { error } = await supabase.auth.setSession({
            access_token: search.access_token,
            refresh_token: search.refresh_token || "",
          });

          if (error) throw error;

          // If we have Google tokens, store them for later use
          if (search.google_access_token) {
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
          }

          // Get user info
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userError) throw userError;

          if (userData.user) {
            // Check if user has completed CV upload
            const { data: prof } = await supabase
              .from("profiles")
              .select("cv_storage_path")
              .eq("id", userData.user.id)
              .maybeSingle();

            if (prof?.cv_storage_path) {
              navigate({ to: "/find-jobs" });
            } else {
              navigate({ to: "/integrations" });
            }
          }
        } else {
          // No tokens, check if already authenticated
          const { data, error } = await supabase.auth.getSession();

          if (error) throw error;

          if (data.session) {
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
  }, [search, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Processing authentication...</p>
    </div>
  );
}
