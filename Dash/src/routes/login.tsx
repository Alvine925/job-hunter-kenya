import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { ensureAuthSessionReady, waitForAuthSession, resetAuthReady } from "@/lib/auth-session";
import { clearUserScopedQueries, prefetchMarketplaceQueries } from "@/lib/marketplace-prefetch";
import { queryClient } from "@/lib/query-client";
import { AuthFlowOverlay } from "@/components/auth/auth-flow-overlay";
import { AuthHeroCarousel } from "@/components/auth/auth-hero-carousel";
import { toast } from "sonner";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { loginWithPassword } from "@/lib/api";

function safeInternalRedirect(value: string | undefined, fallback?: string) {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return fallback;
  return value;
}

function navigateToInternalPath(
  navigate: ReturnType<typeof useNavigate>,
  target: string,
  replace = true,
) {
  if (target.includes("?")) {
    const [path, searchStr] = target.split("?");
    const searchObj = Object.fromEntries(new URLSearchParams(searchStr));
    void navigate({ to: path, search: searchObj, replace } as never);
    return;
  }

  void navigate({ to: target, replace } as never);
}

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string; reason?: string } => {
    return {
      redirect: safeInternalRedirect((search.redirect as string) || undefined),
      reason: search.reason === "session_expired" ? "session_expired" : undefined,
    };
  },
  head: () => ({
    title: "Sign In - Tellus Job Intelligence",
    meta: [
      { title: "Sign In - Tellus Job Intelligence" },
      {
        name: "description",
        content:
          "Sign in to Tellus to manage your job matches, automate applications, and prepare for interviews.",
      },
    ],
  }),
  component: Login,
});

/** Slightly wider hero column than the form on large screens (~56% / 44%). */
const AUTH_PAGE_GRID =
  "grid min-h-screen grid-cols-1 lg:h-screen lg:max-h-screen lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:overflow-hidden";

type AuthMode = "signin" | "signup" | "forgot";
type AuthOverlayKind = "signin" | "signup" | "google" | "forgot" | null;

function HeroPanel({ mode, className }: { mode: AuthMode; className?: string }) {
  return (
    <div className={cn("relative min-h-0 overflow-hidden lg:h-full", className)}>
      <AuthHeroCarousel
        mode={mode === "forgot" ? "signin" : mode}
        fillHeight
        className="absolute inset-0 size-full"
      />
    </div>
  );
}

function MobileHeroBanner({ mode }: { mode: AuthMode }) {
  return (
    <div className="relative h-64 overflow-hidden sm:h-72 lg:hidden">
      <AuthHeroCarousel mode={mode === "forgot" ? "signin" : mode} compact className="h-full" />
    </div>
  );
}

function LoginForm({
  mode,
  fullName,
  email,
  password,
  agreeToTerms,
  onAgreeToTermsChange,
  loading,
  error,
  onFullNameChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onGoogle,
  onToggleMode,
  onForgotPasswordClick,
  sessionExpired,
}: {
  mode: AuthMode;
  fullName: string;
  email: string;
  password: string;
  agreeToTerms: boolean;
  onAgreeToTermsChange: (checked: boolean) => void;
  loading: boolean;
  error: string | null;
  onFullNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onGoogle: () => void;
  onToggleMode: () => void;
  onForgotPasswordClick: () => void;
  sessionExpired?: boolean;
}) {
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";

  if (isForgot) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center sm:mb-8 lg:hidden">
          <span className="text-base font-bold sm:text-lg">Tellus</span>
        </div>

        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Reset your password
          </h1>
          <p className="mt-1.5 text-xs text-muted-foreground sm:mt-2 sm:text-sm">
            Enter your email address and we'll send you a recovery link to choose a new password.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground/90">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              required
              className="h-11 border-border/80 bg-background/50 focus-visible:bg-background"
              placeholder="you@example.com"
            />
          </div>
          {error && (
            <div className="text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg animate-in fade-in duration-200">
              {error}
            </div>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full gap-2 shadow-md shadow-primary/20"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Send reset link
          </Button>
        </form>

        <button
          type="button"
          onClick={onToggleMode}
          className="mt-8 w-full text-center text-sm font-medium text-primary hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-6 flex items-center sm:mb-8 lg:hidden">
        <span className="text-base font-bold sm:text-lg">Tellus</span>
      </div>

      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1.5 text-xs text-muted-foreground sm:mt-2 sm:text-sm">
          {isSignup
            ? "Start applying to matched roles in minutes"
            : "Sign in to continue your job search"}
        </p>
      </div>

      {sessionExpired && !isSignup && (
        <div className="mb-5 rounded-lg border border-[#FD5D28]/25 bg-[#FD5D28]/10 p-3 text-sm font-semibold leading-6 text-[#9A3412] dark:text-orange-200">
          Your session expired. Please log in again to continue.
        </div>
      )}

      <Button
        onClick={onGoogle}
        disabled={loading || (isSignup && !agreeToTerms)}
        variant="outline"
        className="h-11 w-full border-border/80 bg-background/60"
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        )}
        Continue with Google
      </Button>

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/80" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wider">
          <span className="bg-background px-3 text-muted-foreground">or use email</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {isSignup && (
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-foreground/90">
              Full name
            </Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => onFullNameChange(e.target.value)}
              required
              autoComplete="name"
              className="h-11 border-border/80 bg-background/50 focus-visible:bg-background"
              placeholder="Jane Doe"
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground/90">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            required
            className="h-11 border-border/80 bg-background/50 focus-visible:bg-background"
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-foreground/90">
              Password
            </Label>
            {!isSignup && (
              <button
                type="button"
                onClick={onForgotPasswordClick}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Forgot password?
              </button>
            )}
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            required
            minLength={6}
            className="h-11 border-border/80 bg-background/50 focus-visible:bg-background"
            placeholder="••••••••"
          />
        </div>

        {isSignup && (
          <div className="flex items-start space-x-2 pt-1 pb-1">
            <Checkbox
              id="terms"
              checked={agreeToTerms}
              onCheckedChange={(checked) => onAgreeToTermsChange(!!checked)}
              className="mt-1 border-border/80 focus-visible:ring-primary shrink-0 animate-in fade-in"
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="terms"
                className="text-xs font-medium text-muted-foreground leading-normal cursor-pointer select-none"
              >
                I agree to the{" "}
                <Link to="/terms" className="text-primary font-semibold hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="text-primary font-semibold hover:underline">
                  Privacy Policy
                </Link>
                .
              </Label>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg animate-in fade-in duration-200">
            {error}
          </div>
        )}
        <Button
          type="submit"
          disabled={loading || (isSignup && !agreeToTerms)}
          className="h-11 w-full gap-2 shadow-md shadow-primary/20"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {isSignup ? "Create account" : "Sign in"}
        </Button>
      </form>

      <button
        type="button"
        onClick={onToggleMode}
        className="mt-8 w-full text-center text-sm font-medium text-primary hover:underline"
      >
        {isSignup ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
      </button>
    </div>
  );
}

const OVERLAY_MESSAGES: Record<Exclude<AuthOverlayKind, null>, string> = {
  signin: "Signing you in…",
  signup: "Creating your account…",
  google: "Redirecting to Google…",
  forgot: "Sending reset instructions…",
};

const POST_LOGIN_WELCOME_KEY = "tellus_show_welcome_after_login";

function Login() {
  const navigate = useNavigate();
  const { redirect, reason } = useSearch({ from: "/login" });
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<AuthMode>("signin");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [overlay, setOverlay] = useState<AuthOverlayKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    // Check for "ref" query parameter to determine if user should be in signup mode
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("ref")) {
        setMode("signup");
      }
    }
  }, []);

  useEffect(() => {
    if (reason !== "session_expired") return;
    toast.info("Please log in again", {
      description: "Your session expired, so we signed you out safely.",
    });
  }, [reason]);

  useEffect(() => {
    void waitForAuthSession().then((session) => {
      if (session?.user) {
        const target = safeInternalRedirect(
          redirect || localStorage.getItem("post_auth_redirect") || undefined,
          "/marketplace",
        );
        localStorage.removeItem("post_auth_redirect");
        navigateToInternalPath(navigate, target);
      }
    });
  }, [navigate, redirect]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && !agreeToTerms) {
      toast.error("Please agree to the Terms of Service and Privacy Policy to register.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === "signup") {
        const trimmedName = fullName.trim();
        if (!trimmedName) {
          toast.error("Please enter your full name");
          setLoading(false);
          return;
        }

        // Show signup loading overlay immediately to prevent user interaction and show progress
        setOverlay("signup");

        const params = new URLSearchParams(window.location.search);
        const refCode = params.get("ref") || undefined;

        if (redirect) {
          localStorage.setItem("post_auth_redirect", redirect);
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirect
              ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`
              : `${window.location.origin}/auth/callback`,
            data: {
              full_name: trimmedName,
              ref: refCode,
            },
          },
        });
        if (error) throw error;

        if (data.session && data.user) {
          // Clear cached auth promise to force the layout to detect the session
          resetAuthReady();
          await ensureAuthSessionReady();
          clearUserScopedQueries(queryClient);
          setOverlay(null);
          navigate({ to: "/onboarding", replace: true });
          return;
        } else {
          setOverlay(null);
          setEmailSent(true);
        }
      } else if (mode === "forgot") {
        setOverlay("forgot");
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset instructions sent! Please check your email inbox.");
        setOverlay(null);
        setMode("signin");
      } else {
        setOverlay("signin");

        // Use Edge Function-based login to enforce rate limiting/lockout
        await loginWithPassword(email, password);

        await ensureAuthSessionReady();
        clearUserScopedQueries(queryClient);
        sessionStorage.setItem(POST_LOGIN_WELCOME_KEY, "true");
        // Warm the cache in the background — don't block navigation on it.
        void prefetchMarketplaceQueries(queryClient);

        const target = safeInternalRedirect(
          redirect || localStorage.getItem("post_auth_redirect") || undefined,
          "/marketplace",
        );
        localStorage.removeItem("post_auth_redirect");
        navigateToInternalPath(navigate, target);
        return;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      toast.error(msg);
      setOverlay(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (mode === "signup" && !agreeToTerms) {
      toast.error("Please agree to the Terms of Service and Privacy Policy to register.");
      return;
    }
    setLoading(true);
    setOverlay("google");
    try {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get("ref");

      if (redirect) {
        localStorage.setItem("post_auth_redirect", safeInternalRedirect(redirect, "/marketplace"));
      } else {
        const urlRedirect = params.get("redirect");
        if (urlRedirect) {
          localStorage.setItem(
            "post_auth_redirect",
            safeInternalRedirect(urlRedirect, "/marketplace"),
          );
        }
      }

      const initUrl = refCode
        ? `/api/auth/google-init?ref=${encodeURIComponent(refCode)}`
        : "/api/auth/google-init";
      window.location.href = initUrl;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
      setOverlay(null);
    }
  };

  const handleForgotPasswordClick = () => {
    setMode("forgot");
  };

  const handleToggleMode = () => {
    if (mode === "forgot") {
      setMode("signin");
    } else {
      setMode(mode === "signin" ? "signup" : "signin");
    }
  };

  const formProps = {
    mode,
    fullName,
    email,
    password,
    agreeToTerms,
    onAgreeToTermsChange: (v: boolean) => setAgreeToTerms(v),
    loading,
    error,
    onFullNameChange: (v: string) => {
      setFullName(v);
      setError(null);
    },
    onEmailChange: (v: string) => {
      setEmail(v);
      setError(null);
    },
    onPasswordChange: (v: string) => {
      setPassword(v);
      setError(null);
    },
    onSubmit: handleEmail,
    onGoogle: handleGoogle,
    onToggleMode: () => {
      handleToggleMode();
      setError(null);
    },
    onForgotPasswordClick: () => {
      handleForgotPasswordClick();
      setError(null);
    },
    sessionExpired: reason === "session_expired",
  };

  const heroMode = mode === "forgot" ? "signin" : mode;

  if (emailSent) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center px-6 py-8 sm:px-12">
        <div className="mx-auto w-full max-w-sm text-center space-y-5 animate-in fade-in duration-300">
          <div className="flex items-center justify-center mb-2">
            <span className="text-xl font-bold tracking-tight text-foreground">Tellus</span>
          </div>
          <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center border border-orange-100 dark:border-orange-900/30 mx-auto shadow-sm">
            <Mail className="w-8 h-8 text-[#F4986C] animate-bounce" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Confirm your email
            </h1>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              We've sent a verification link to{" "}
              <strong className="text-foreground font-semibold">{email}</strong>.
            </p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Please click the link in the email to verify your account and proceed to onboarding.
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-muted/10 p-4 rounded-xl text-left border border-slate-100 dark:border-muted/20 text-xs text-muted-foreground space-y-1.5 max-w-sm mx-auto shadow-inner">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Tips:</span>
            <p>• Check your Spam, Junk, or Updates folders if you don't see it in a few minutes.</p>
            <p>• The verification link is valid for 24 hours.</p>
          </div>
          <div className="pt-2">
            <Button
              onClick={() => {
                setEmailSent(false);
                setMode("signin");
              }}
              variant="outline"
              className="w-full max-w-sm h-10 border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold transition-all active:scale-95"
            >
              Back to Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {overlay && <AuthFlowOverlay message={OVERLAY_MESSAGES[overlay]} />}

      {mode === "signin" || mode === "forgot" ? (
        <div className={AUTH_PAGE_GRID}>
          <HeroPanel mode={heroMode} className="hidden lg:block" />
          <MobileHeroBanner mode={heroMode} />
          <div className="flex min-h-0 flex-col justify-center px-6 py-12 sm:px-12 xl:px-20 lg:h-full lg:overflow-y-auto">
            <LoginForm {...formProps} />
          </div>
        </div>
      ) : (
        <div className={AUTH_PAGE_GRID}>
          <div className="order-2 flex min-h-0 flex-col justify-center px-6 py-12 sm:px-12 xl:px-20 lg:order-1 lg:h-full lg:overflow-y-auto">
            <LoginForm {...formProps} />
          </div>
          <HeroPanel mode="signup" className="order-1 hidden lg:order-2 lg:block" />
          <div className="order-1 lg:hidden">
            <MobileHeroBanner mode="signup" />
          </div>
        </div>
      )}
    </div>
  );
}
