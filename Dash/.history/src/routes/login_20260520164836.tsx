import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: prof } = await supabase.from("profiles").select("cv_storage_path").eq("id", data.user.id).maybeSingle();
        if (prof?.cv_storage_path) {
          navigate({ to: "/find-jobs" });
        } else {
          navigate({ to: "/integrations" });
        }
      }
    });
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://nrrmbjgrqqtfhooqeowo.supabase.co";
        const callbackUrl = `${supabaseUrl}/functions/v1/auth/callback`;
        
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callbackUrl } });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          const { data: prof } = await supabase.from("profiles").select("cv_storage_path").eq("id", data.user.id).maybeSingle();
          if (prof?.cv_storage_path) {
              navigate({ to: "/find-jobs" });
          } else {
            navigate({ to: "/integrations" });
          }
        }
      }
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      // Edge function handles the OAuth callback and token exchange
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://nrrmbjgrqqtfhooqeowo.supabase.co";
      const callbackUrl = `${supabaseUrl}/functions/v1/auth/callback`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
          scopes: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents",
        },
      });
      if (error) {
        toast.error(error.message);
        setLoading(false);
      }
    } catch (err: any) {
      toast.error(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar p-6">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">JobHunter KE</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">{mode === "signin" ? "Sign in to your account" : "Create your account"}</p>
        <Button onClick={handleGoogle} disabled={loading} variant="outline" className="w-full">Continue with Google</Button>
        <div className="my-4 text-center text-xs text-muted-foreground">or</div>
        <form onSubmit={handleEmail} className="space-y-3">
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
          <Button type="submit" disabled={loading} className="w-full">{mode === "signin" ? "Sign in" : "Create account"}</Button>
        </form>
        <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-4 text-sm text-primary w-full text-center">
          {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </Card>
    </div>
  );
}
