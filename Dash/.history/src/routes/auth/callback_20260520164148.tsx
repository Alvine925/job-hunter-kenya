import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallback });

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase automatically handles the OAuth callback
        // The session will be set by the auth provider
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (data.session) {
          // Check if user has completed CV upload
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
      } catch (error: any) {
        toast.error("Authentication failed: " + error.message);
        navigate({ to: "/login" });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Processing authentication...</p>
    </div>
  );
}
