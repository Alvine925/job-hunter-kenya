import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryProvider } from "@/components/query-provider";
import { ErrorInterceptorDialog } from "@/components/error-interceptor";
import { getConsoleOverrideScript } from "@/lib/silence-console";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { RouteProgress } from "@/components/route-progress";
import { buildLoginRedirectPath, isAuthSessionError } from "@/lib/auth-session";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const isSessionError = isAuthSessionError(error);

  useEffect(() => {
    if (typeof window !== "undefined" && isSessionError) {
      const timeout = window.setTimeout(() => {
        window.location.assign(buildLoginRedirectPath());
      }, 1200);
      return () => window.clearTimeout(timeout);
    }
  }, [isSessionError]);

  if (isSessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-10 dark:bg-[#0B0F19]">
        <div className="w-full max-w-md rounded-xl border border-slate-200/80 bg-white p-6 text-center shadow-sm dark:border-border/20 dark:bg-slate-950 sm:p-8">
          <div className="mx-auto mb-5 flex size-11 items-center justify-center rounded-xl bg-[#FD5D28]/10 text-[#FD5D28]">
            <span className="text-lg font-black">!</span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            Please log in again
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Your session has expired. We are taking you back to login so you can continue safely.
          </p>
          <div className="mt-6">
            <a
              href={buildLoginRedirectPath()}
              className="inline-flex items-center justify-center rounded-lg bg-[#FD5D28] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#FD5D28]/90"
            >
              Go to login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-10 dark:bg-[#0B0F19]">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white p-6 text-left shadow-sm dark:border-border/20 dark:bg-slate-950 sm:p-8">
        <div className="mb-5 inline-flex rounded-full bg-[#FD5D28]/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#FD5D28]">
          Service interruption
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">
          We could not load this workspace
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Tellus hit an unexpected issue while preparing this page. Your account data is safe, and
          refreshing usually restores the workspace.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          If this keeps happening, please report it or reach us directly at{" "}
          <a
            href="mailto:hello@tellusjobs.site"
            className="font-semibold text-[#FD5D28] hover:underline"
          >
            hello@tellusjobs.site
          </a>
          .
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-[#FD5D28] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#FD5D28]/90"
          >
            Try again
          </button>
          <Link
            to="/feedback"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 dark:border-border/30 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900"
          >
            Report this issue
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    title: "Tellus - Premium Job Intelligence",
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Tellus - Premium Job Intelligence" },
      {
        name: "description",
        content: "Tellus helps you find, match, and apply for the best career opportunities.",
      },
      { name: "author", content: "Tellus" },
      { property: "og:title", content: "Tellus - Premium Job Intelligence" },
      {
        property: "og:description",
        content: "Find and match with the best career opportunities using Tellus.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/logo.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/logo.png" },
      { name: "twitter:title", content: "Tellus - Premium Job Intelligence" },
      {
        name: "twitter:description",
        content: "Find and match with the best career opportunities using Tellus.",
      },
    ],
    links: [
      {
        rel: "icon",
        type: "image/png",
        href: "/favicon.png",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: getConsoleOverrideScript(import.meta.env.PROD) }}
        />
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) {
        localStorage.setItem("referral_code", ref);
      }
    }
  }, []);

  return (
    <QueryProvider>
      <RouteProgress />
      <Outlet />
      <ErrorInterceptorDialog />
    </QueryProvider>
  );
}
