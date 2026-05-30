import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { hasLikelyStoredSession, resetAuthReady } from "@/lib/auth-session";
import { supabase } from "@/integrations/supabase/client";
import { TellusLoader } from "@/components/ui/tellus-loader";

/**
 * Lightweight client-side auth boundary.
 *
 * The route's `beforeLoad` (in `_authenticated.tsx`) already validated the
 * Supabase session before rendering, so we don't re-verify here — that double
 * check is what was bouncing users back to `/login` right after sign-in. We
 * only watch for live `SIGNED_OUT` events so the user is redirected if their
 * session is invalidated while the app is open.
 */
export function ClientAuthGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) {
        resetAuthReady();
        const redirect = window.location.pathname + window.location.search;
        navigate({ to: "/login", search: { redirect, reason: "session_expired" }, replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isMounted, navigate]);

  // Avoid a hydration mismatch flash on the very first paint.
  if (!isMounted && !hasLikelyStoredSession()) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <TellusLoader size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
