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
  };

  useEffect(() => {
    const handleCallback = async () => {
      try {
        if (search.access_token) {
          // Set the session from tokens passed by edge function
          const { error } = await supabase.auth.setSession({
            access_token: search.access_token,
            refresh_token: search.refresh_token || "",
          });

          if (error) throw error;

          // Get current user
          const { data, error: userError } = await supabase.auth.getUser();
          if (userError) throw userError;

          if (data.user) {
            // Check if user has completed CV upload
            const { data: prof } = await supabase
              .from("profiles")
              .select("cv_storage_path")
              .eq("id", data.user.id)
              .maybeSingle();

            if (prof?.cv_storage_path) {
              navigate({ to: "/find-jobs" });
            } else {
              navigate({ to: "/integrations" });
            }
          }
        } else {
          // Check if already authenticated
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
