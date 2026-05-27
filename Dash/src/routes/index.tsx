import { createFileRoute, redirect } from "@tanstack/react-router";
import { isBrowser, getSessionUser } from "@/lib/auth-session";
import { TellusLoader } from "@/components/ui/tellus-loader";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (!isBrowser()) {
      throw redirect({ to: "/login" });
    }
    const user = await getSessionUser();
    throw redirect({ to: user ? "/marketplace" : "/login" });
  },
  component: IndexRedirecting,
});

function IndexRedirecting() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
      <TellusLoader />
      <p className="text-sm">Loading Tellus…</p>
    </div>
  );
}
