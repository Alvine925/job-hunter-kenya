import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  Link2, 
  Mail, 
  FolderOpen, 
  FileText, 
  HelpCircle,
  Loader2 
} from "lucide-react";

interface AppErrorDetail {
  error: any;
  message: string;
  section: string;
  action: string;
}

export function getSectionFromPath(path: string): string {
  if (path.includes("/jobs/")) return "Job Details";
  if (path.includes("/marketplace/")) return "Marketplace Job Listing";
  if (path.startsWith("/dashboard")) return "Dashboard";
  if (path.startsWith("/find-jobs")) return "My Jobs";
  if (path.startsWith("/applications")) return "Applications";
  if (path.startsWith("/marketplace")) return "Job Marketplace";
  if (path.startsWith("/monitors")) return "Monitored Sites";
  if (path.startsWith("/templates")) return "Templates";
  if (path.startsWith("/profile")) return "My CV";
  if (path.startsWith("/configuration")) return "Configuration";
  if (path.startsWith("/feedback")) return "Feedback";
  if (path.startsWith("/settings")) return "Settings";
  if (path.startsWith("/onboarding")) return "Onboarding";
  return "System";
}

export function detectActionFromMessage(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("gmail") || m.includes("send email") || m.includes("send-email")) return "Sending Application Email";
  if (m.includes("drive") || m.includes("save-pack-to-drive")) return "Saving Application Pack to Drive";
  if (m.includes("generate-letter") || m.includes("cover letter")) return "Generating Cover Letter";
  if (m.includes("generate-pack") || m.includes("application pack")) return "Generating Application Pack";
  if (m.includes("interview")) return "Generating Interview Prep";
  return "Processing Request";
}

export function interceptError(error: unknown, context?: { section?: string; action?: string }): boolean {
  if (typeof window === "undefined") return false;
  
  const msg = error instanceof Error ? error.message : typeof error === "string" ? error : String(error);
  
  // Detect if it is a Google token error or general Edge Function error
  const isGoogle = 
    msg.includes("Connect Google in Settings") || 
    msg.includes("Google session expired") || 
    msg.includes("google_access_token") || 
    msg.includes("googleAccessToken") || 
    msg.includes("provider_token") || 
    msg.includes("refreshGoogleAccessToken") ||
    msg.includes("user_integrations lookup failed");

  const isEdge = 
    msg.includes("Edge function") || 
    msg.includes("Failed to fetch") || 
    msg.includes("546") || 
    msg.includes("WORKER_RESOURCE_LIMIT");

  if (isGoogle || isEdge) {
    const event = new CustomEvent("app-error", {
      detail: {
        error,
        message: msg,
        section: context?.section || getSectionFromPath(window.location.pathname),
        action: context?.action || detectActionFromMessage(msg)
      }
    });
    window.dispatchEvent(event);
    return true;
  }
  
  return false;
}

export function ErrorInterceptorDialog() {
  const navigate = useNavigate();
  const [errorDetails, setErrorDetails] = useState<AppErrorDetail | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Handle the custom app-error event
    const handleAppError = (e: Event) => {
      const detail = (e as CustomEvent<AppErrorDetail>).detail;
      setErrorDetails(detail);
      setIsOpen(true);
    };

    window.addEventListener("app-error", handleAppError);

    // Monkeypatch toast.error to intercept and suppress known errors
    const originalToastError = toast.error;
    
    toast.error = (message, data) => {
      const msg = message instanceof Error ? message.message : String(message);
      const wasIntercepted = interceptError(message, {
        section: getSectionFromPath(window.location.pathname),
        action: detectActionFromMessage(msg)
      });
      
      if (wasIntercepted) {
        return ""; // Suppress toast
      }
      
      return originalToastError(message, data);
    };

    return () => {
      window.removeEventListener("app-error", handleAppError);
      toast.error = originalToastError;
    };
  }, []);

  if (!errorDetails) return null;

  const { message, action, section } = errorDetails;

  // Determine translation values
  let title = "Error Encountered";
  let cleanMessage = message;
  let connectionType: "email" | "drive" | "docs" | "google" | undefined;
  let needsGoogleConnection = false;

  const isGoogleError = 
    message.includes("Connect Google in Settings") || 
    message.includes("Google session expired") || 
    message.includes("google_access_token") || 
    message.includes("googleAccessToken") || 
    message.includes("provider_token") || 
    message.includes("refreshGoogleAccessToken") ||
    message.includes("user_integrations lookup failed");

  if (isGoogleError) {
    needsGoogleConnection = true;
    const lowerAction = action.toLowerCase();
    
    if (lowerAction.includes("email") || lowerAction.includes("mail") || message.toLowerCase().includes("gmail")) {
      title = "Email Not Connected";
      cleanMessage = "Gmail is not connected. Please connect your Google account with email drafting and sending permissions.";
      connectionType = "email";
    } else if (lowerAction.includes("drive") || message.toLowerCase().includes("drive")) {
      title = "Google Drive Not Connected";
      cleanMessage = "Google Drive is not connected. Please connect your Google account to enable saving application packages.";
      connectionType = "drive";
    } else if (lowerAction.includes("doc") || lowerAction.includes("pack") || lowerAction.includes("letter") || message.toLowerCase().includes("document")) {
      title = "Google Docs Not Connected";
      cleanMessage = "Google Docs is not connected. Please connect your Google account to create and edit documents.";
      connectionType = "docs";
    } else {
      title = "Google Workspace Not Connected";
      cleanMessage = "Your Google account is not connected. Please link your account to enable Gmail and Drive automations.";
      connectionType = "google";
    }
  } else if (
    message.includes("Edge function") || 
    message.includes("Failed to fetch") || 
    message.includes("NetworkError") ||
    message.includes("546") || 
    message.includes("WORKER_RESOURCE_LIMIT")
  ) {
    title = "Edge Server Error";
    cleanMessage = "The background edge function server is currently unavailable or resource limits have been reached. Please try again in a few moments.";
  }

  const handleConnectGoogle = async () => {
    setConnecting(true);
    try {
      const returnUrl = window.location.href;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: returnUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
          scopes: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents",
        },
      });
      if (error) throw error;
    } catch (e: any) {
      toast.error(`Google Connection failed: ${e.message}`);
      setConnecting(false);
    }
  };

  const handleReport = () => {
    setIsOpen(false);
    
    // Extract stack trace if available
    let stack = "";
    if (errorDetails.error instanceof Error) {
      stack = errorDetails.error.stack || "";
    } else if (errorDetails.error && typeof errorDetails.error === "object") {
      stack = JSON.stringify(errorDetails.error, null, 2);
    }
    
    // Save to session storage for the report page
    sessionStorage.setItem(
      "pending_error_report",
      JSON.stringify({
        error_message: message,
        error_stack: stack,
        section,
        action,
      })
    );
    
    // Navigate to /error-report
    void navigate({ to: "/error-report" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="rounded-none sm:rounded-none border border-white/10 bg-card/95 backdrop-blur-xl max-w-md p-6">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-rose-500/10 border border-rose-500/20 text-rose-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-extrabold tracking-tight text-foreground">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {section} &bull; {action}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-4">
          <p className="text-sm text-foreground/90 leading-relaxed font-normal">
            {cleanMessage}
          </p>

          {needsGoogleConnection && (
            <div className="bg-white/5 border border-white/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-primary/10 text-primary border border-primary/20 mt-0.5">
                  {connectionType === "email" ? (
                    <Mail className="w-4 h-4" />
                  ) : connectionType === "drive" ? (
                    <FolderOpen className="w-4 h-4" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground capitalize">
                    {connectionType || "Google"} Connection Required
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                    This action requires access to write cover letters and drafts directly to your account.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-2">
          <Button
            variant="ghost"
            onClick={handleReport}
            className="rounded-none text-xs font-semibold hover:bg-white/5"
          >
            Report Error
          </Button>
          
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="rounded-none text-xs font-semibold border-white/10 hover:bg-white/5"
            >
              Dismiss
            </Button>
            
            {needsGoogleConnection && (
              <Button
                onClick={handleConnectGoogle}
                disabled={connecting}
                className="rounded-none text-xs font-semibold gap-1.5 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
              >
                {connecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Link2 className="w-3.5 h-3.5" />
                )}
                Connect Google
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
