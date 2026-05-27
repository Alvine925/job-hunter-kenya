import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { clearOnboardingCache } from "@/lib/auth-session";
import { 
  Mail, 
  FolderOpen, 
  FileText, 
  CheckCircle2, 
  ArrowRight, 
  Lock,
  Loader2,
  Sparkles,
  Link2
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({
    title: "Integrations - Tellus",
    meta: [
      { title: "Integrations - Tellus" },
      { name: "description", content: "Connect your Tellus account with external platforms like Google Drive." },
    ],
  }),
  component: Integrations,
});

function Integrations() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Retrieve user to check linked identities
  const { data: user, isLoading } = useQuery({
    queryKey: ["current_user_auth"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    }
  });

  const isGoogleConnected = user?.identities?.some(i => i.provider === "google") ?? false;

  useEffect(() => {
    if (!isGoogleConnected || !user?.id) return;
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session?.provider_token && !session?.provider_refresh_token) return;
      await supabase.from("user_integrations").upsert({
        user_id: user.id,
        google_access_token: session.provider_token,
        google_refresh_token: session.provider_refresh_token,
        google_connected: true,
        google_scopes: [
          "https://www.googleapis.com/auth/gmail.send",
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/documents",
        ],
      });
      clearOnboardingCache();
      navigate({ to: "/onboarding" });
    });
  }, [isGoogleConnected, navigate, user?.id]);

  const handleConnectGoogle = async () => {
    setConnecting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/integrations`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
          scopes: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents",
        },
      });
      if (error) throw error;
    } catch (e: any) {
      toast.error(`OAuth link failed: ${e.message}`);
      setConnecting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-0 py-6 sm:py-10 px-4 sm:px-6 bg-gradient-to-br from-background via-sidebar to-background">
      {/* Onboarding Steps */}
      <div className="w-full max-w-xl mb-6 sm:mb-8 flex items-center justify-between gap-2 sm:gap-4 px-1 sm:px-4">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-lg shadow-primary/20">
            1
          </div>
          <span className="text-[10px] sm:text-xs font-semibold mt-2 text-foreground text-center">Integrations</span>
        </div>
        <div className="flex-1 min-w-2 h-[2px] bg-white/10 mx-1 sm:mx-4" />
        <div className="flex flex-col items-center shrink-0">
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-muted-foreground flex items-center justify-center font-semibold text-sm">
            2
          </div>
          <span className="text-[10px] sm:text-xs text-muted-foreground mt-2 text-center">Upload CV</span>
        </div>
        <div className="flex-1 min-w-2 h-[2px] bg-white/10 mx-1 sm:mx-4" />
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-muted-foreground flex items-center justify-center font-semibold text-sm">
            3
          </div>
          <span className="text-[10px] sm:text-xs text-muted-foreground mt-2 text-center">Create Profile</span>
        </div>
      </div>

      <Card className="w-full max-w-xl p-4 sm:p-6 lg:p-8 bg-card/60 border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        {/* Decorative ambient light */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground mt-4">Loading your connection status...</p>
          </div>
        ) : !isGoogleConnected ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Onboarding Step 1</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">Connect Google Workspace</h1>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              Tellus runs background workflows to find and apply to jobs for you. Connecting your Google account allows the agent to draft cover letters and send applications under your profile.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition duration-300">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20">
                  <Mail className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Gmail Integration</h3>
                  <p className="text-xs text-muted-foreground mt-1">Allows the AI worker to send job application emails directly from your email address.</p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition duration-300">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                  <FolderOpen className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Google Drive & Docs</h3>
                  <p className="text-xs text-muted-foreground mt-1">Allows the agent to generate and save tailored cover letters and keep your applications organized.</p>
                </div>
              </div>
            </div>

            <Button onClick={() => setModalOpen(true)} className="w-full py-6 text-sm font-semibold rounded-xl gap-2 shadow-lg shadow-primary/20 hover:scale-[1.01] transition-transform duration-200">
              <Link2 className="w-4 h-4" /> Link Google Account
            </Button>
          </>
        ) : (
          <div className="py-6 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-bounce" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Google Connected!</h1>
            <p className="text-sm text-muted-foreground max-w-sm mb-8 leading-relaxed">
              Your Google Account is connected. The agent has correct permissions to draft applications and sync files.
            </p>
            <Button 
              onClick={() => navigate({ to: "/onboarding" })} 
              className="w-full py-6 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 rounded-xl gap-2 shadow-lg shadow-emerald-600/20 hover:scale-[1.01] transition duration-200"
            >
              Proceed to CV Upload <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </Card>

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">Authorize Permissions</h3>
                <p className="text-xs text-muted-foreground">Secure OAuth Connection</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              To proceed, Google will request permissions for **Gmail Send** and **Drive File Access**. 
              These are required for Tellus to automatically format and mail your applications.
            </p>

            <div className="bg-white/5 p-4 rounded-xl space-y-2 mb-6 border border-white/5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Direct integration (No third-party middleware)</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Revocable at any time in Google Settings</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={connecting} className="rounded-xl">
                Cancel
              </Button>
              <Button onClick={handleConnectGoogle} disabled={connecting} className="rounded-xl gap-2">
                {connecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Connecting...
                  </>
                ) : (
                  "Allow Access"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
