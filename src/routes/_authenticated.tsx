import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });

    // Onboarding gate: send users to CV upload if they haven't uploaded one yet.
    // Skip the gate for the onboarding page itself, profile, and configuration so users can navigate freely.
    const path = location.pathname;
    const onOnboarding = path.startsWith("/onboarding") || path.startsWith("/profile") || path.startsWith("/configuration");
    if (!onOnboarding) {
      const { data: prof } = await supabase.from("profiles").select("cv_storage_path").eq("id", data.user.id).maybeSingle();
      if (!prof?.cv_storage_path) throw redirect({ to: "/onboarding/cv" });
    }
  },
  component: () => <AppLayout />,
});
