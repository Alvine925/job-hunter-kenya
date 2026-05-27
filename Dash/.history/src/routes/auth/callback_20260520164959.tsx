import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallback });

function AuthCallback() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/callback" }) as {
    code?: string;
    state?: string;
    error?: string;
  };

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Handle OAuth errors
        if (search.error) {
          throw new Error(search.error);
        }

        // If authorization code is present, exchange it via edge function
        if (search.code) {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://nrrmbjgrqqtfhooqeowo.supabase.co";
          const response = await fetch(`${supabaseUrl}/functions/v1/auth/callback`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              code: search.code,
              state: search.state,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Token exchange failed");
          }

          const data = await response.json();

          // Set session with tokens from edge function
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token || "",
          });

          if (sessionError) throw sessionError;

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
          // No code, check if already authenticated
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
