import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { ClientAuthGuard } from "@/components/auth-guard";
import { checkServerSession } from "@/lib/auth-check.server";
import {
  getOnboardingStatus,
  isBrowser,
  requireSessionUser,
  getCachedSession,
  hasPassedOnboarding,
  setPassedOnboarding,
} from "@/lib/auth-session";

export const Route = createFileRoute("/_authenticated")({
  // CRITICAL: This must NOT be async. An async function always returns a Promise,
  // which makes TanStack Router treat every navigation as "pending" and flash a spinner.
  // Instead, return undefined synchronously on cache hit (instant navigation),
  // and only return a Promise when we actually need to do async work (first load).
  beforeLoad: ({ location }) => {
    if (!isBrowser()) {
      return checkServerSession().then(({ hasSession }) => {
        if (!hasSession) {
          throw redirect({ to: "/login" });
        }
      });
    }

    // Fast path: if session is cached and onboarding already passed, return
    // undefined synchronously. This makes navigation between pages INSTANT
    // because TanStack Router sees no Promise and commits the route immediately.
    const session = getCachedSession();
    if (session && hasPassedOnboarding()) {
      return; // ← synchronous return, no Promise, no spinner, instant navigation
    }

    // Slow path (first page load only): return a Promise so the router waits.
    // This only runs once — after it completes, all subsequent navigations
    // hit the fast path above.
    return (async () => {
      const user = session?.user || await requireSessionUser();
      if (!user) return;

      const path = location.pathname;

      // Allow access to onboarding and profile paths to let users fill out details
      if (path.startsWith("/onboarding") || path.startsWith("/profile") || path.startsWith("/integrations")) {
        return;
      }

      const { hasCv, hasSetPassword, onboardingCompleted } = await getOnboardingStatus(user.id);

      // Google OAuth signups must set a local password first (strict security blocker)
      if (!hasSetPassword) {
        throw redirect({ to: "/onboarding" });
      }

      // New signups who haven't completed onboarding and don't have a CV are guided to the onboarding wizard
      if (!onboardingCompleted && !hasCv) {
        throw redirect({ to: "/onboarding" });
      }

      // Cache that onboarding has passed so subsequent navigations are instant
      setPassedOnboarding(true);
    })();
  },
  component: () => (
    <ClientAuthGuard>
      <AppLayout />
    </ClientAuthGuard>
  ),
});
