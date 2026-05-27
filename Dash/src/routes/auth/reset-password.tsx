import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import passwordHero from "@/assets/password-hero.png";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({
    title: "Reset Password - Tellus",
    meta: [
      { title: "Reset Password - Tellus" },
      { name: "description", content: "Choose a new secure password to access your Tellus account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setHasSession(true);
      } else {
        // Try getting user directly in case session state is syncing
        const { data: { user } } = await supabase.auth.getUser();
        setHasSession(!!user);
      }
      setSessionChecked(true);
    };
    
    // Set up auth state listener to catch late parsed hash fragments
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setHasSession(true);
        setSessionChecked(true);
      }
    });

    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const passwordStrength =
    password.length === 0
      ? null
      : password.length < 6
        ? "weak"
        : password.length < 10
          ? "fair"
          : "strong";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Password updated successfully! Redirecting...");
      navigate({ to: "/marketplace", replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
        {/* ── Hero panel (desktop) ── */}
        <div className="relative hidden lg:flex flex-col justify-end overflow-hidden bg-sidebar min-h-screen">
          <img
            src={passwordHero}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="relative z-10 p-10 xl:p-14 text-white max-w-xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-sm font-semibold tracking-wide uppercase text-white/90">
                Tellus
              </span>
            </div>
            <h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight">
              Reset your account password.
            </h2>
            <p className="mt-4 text-white/75 text-base leading-relaxed">
              Create a new secure password to access your matched roles and application history.
            </p>
          </div>
        </div>

        {/* ── Mobile hero strip ── */}
        <div className="relative h-44 lg:hidden overflow-hidden bg-sidebar">
          <img
            src={passwordHero}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
          />
          <div className="relative z-10 flex items-end h-full p-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="text-xs font-semibold tracking-wide uppercase text-white/90">
                  Tellus
                </span>
              </div>
              <h2 className="text-xl font-bold text-white leading-tight">
                Reset Password
              </h2>
            </div>
          </div>
        </div>

        {/* ── Form panel ── */}
        <div className="flex flex-col justify-center px-6 py-12 sm:px-12 xl:px-20 lg:min-h-screen">
          <div className="w-full max-w-md mx-auto">
            {/* Mobile brand */}
            <div className="lg:hidden flex items-center gap-2 mb-8">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="font-bold text-lg">Tellus</span>
            </div>

            {!hasSession ? (
              <div className="space-y-4">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  Invalid Link
                </h1>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Your password reset link is invalid or has expired. Please request a new password reset email from the login page.
                </p>
                <Button
                  onClick={() => navigate({ to: "/login" })}
                  className="w-full h-11 gap-2 mt-4"
                >
                  Go to Login
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Choose a new password
                  </h1>
                  <p className="text-muted-foreground mt-2 text-sm">
                    Enter your new secure password below to regain access to your account.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Password field */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground/90">
                      New Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="h-11 pl-10 pr-10 bg-background/50 border-border/80 focus-visible:bg-background"
                        placeholder="At least 6 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Strength indicator */}
                    {passwordStrength && (
                      <div className="flex items-center gap-2 pt-1">
                        <div className="flex gap-1 flex-1">
                          {[1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className={cn(
                                "h-1 flex-1 rounded-full transition-colors duration-300",
                                passwordStrength === "weak" && i === 1
                                  ? "bg-destructive"
                                  : passwordStrength === "fair" && i <= 2
                                    ? "bg-amber-400"
                                    : passwordStrength === "strong"
                                      ? "bg-emerald-500"
                                      : "bg-border",
                              )}
                            />
                          ))}
                        </div>
                        <span
                          className={cn(
                            "text-xs font-medium capitalize",
                            passwordStrength === "weak" && "text-destructive",
                            passwordStrength === "fair" && "text-amber-500",
                            passwordStrength === "strong" && "text-emerald-600",
                          )}
                        >
                          {passwordStrength}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Confirm password field */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-foreground/90">
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        className="h-11 pl-10 pr-10 bg-background/50 border-border/80 focus-visible:bg-background"
                        placeholder="Re-enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                      >
                        {showConfirm ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <p className="text-xs text-destructive">
                      Passwords do not match
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || password.length < 6 || password !== confirmPassword}
                    className="w-full h-11 gap-2 shadow-md shadow-primary/20"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    Reset password & sign in
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
