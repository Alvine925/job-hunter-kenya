import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  AlertTriangle, 
  ChevronLeft, 
  Loader2, 
  Send,
  Code,
  CheckCircle2
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/error-report")({
  head: () => ({
    title: "Error Reports - Tellus",
    meta: [
      { title: "Error Reports - Tellus" },
      { name: "description", content: "Report issues or view existing application errors and logs." },
    ],
  }),
  component: ErrorReportPage,
});

interface PendingReport {
  error_message: string;
  error_stack: string;
  section: string;
  action: string;
}

function ErrorReportPage() {
  const navigate = useNavigate();
  const [report, setReport] = useState<PendingReport | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showStack, setShowStack] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const data = sessionStorage.getItem("pending_error_report");
    if (data) {
      try {
        setReport(JSON.parse(data));
      } catch (e) {
        console.error("Failed to parse pending error report:", e);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report) return;

    setSubmitting(true);
    try {
      const { data: authUser } = await supabase.auth.getUser();
      const userId = authUser?.user ? authUser.user.id : null;

      const { error } = await supabase.from("error_reports" as any).insert({
        user_id: userId,
        error_message: report.error_message,
        error_stack: report.error_stack,
        section: report.section,
        action_context: report.action,
        user_description: description.trim() || null,
      });

      if (error) throw error;

      sessionStorage.removeItem("pending_error_report");
      setSubmitted(true);
      toast.success("Error report submitted. Thank you!");
      
      // Auto redirect after 2.5 seconds
      setTimeout(() => {
        void navigate({ to: "/dashboard" });
      }, 2500);

    } catch (err: any) {
      toast.error(`Failed to submit report: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 text-muted-foreground">
          <HelpCircleIcon className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">No Pending Report</h1>
        <p className="text-sm text-muted-foreground leading-normal">
          There are no unsaved error reports detected. If you encountered an issue, try reproducing it.
        </p>
        <Button 
          variant="outline" 
          onClick={() => void navigate({ to: "/dashboard" })}
          className="rounded-none mt-2 text-xs font-semibold"
        >
          Go to Dashboard
        </Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center space-y-4 max-w-md mx-auto animate-in fade-in duration-300">
        <div className="w-12 h-12 flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
          <CheckCircle2 className="w-6 h-6 animate-bounce" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Report Submitted Successfully</h1>
        <p className="text-sm text-muted-foreground leading-normal">
          Thank you for reporting this issue. Our development team has been notified and will investigate the logs.
        </p>
        <p className="text-xs text-primary animate-pulse font-medium">
          Redirecting you back to safety...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Back Button */}
      <button
        onClick={() => window.history.back()}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Previous Page
      </button>

      {/* Header */}
      <div className="space-y-1.5 border-b border-border/20 pb-4">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
          Submit Error Report
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Report technical bugs to help us identify and resolve platform issues.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Context Banner */}
        <div className="border border-rose-500/10 bg-rose-500/5 p-4 space-y-3.5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-rose-500/10 text-rose-500 border border-rose-500/20 mt-0.5">
              <AlertTriangle className="w-4.5 h-4.5" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="text-xs font-black tracking-wider text-rose-500 uppercase">
                Captured System Failure
              </h3>
              <p className="text-sm font-bold text-foreground truncate">
                {report.error_message}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-rose-500/10 text-xs">
            <div>
              <span className="text-muted-foreground block font-medium">System Section:</span>
              <span className="font-semibold text-foreground">{report.section}</span>
            </div>
            <div>
              <span className="text-muted-foreground block font-medium">Attempted Action:</span>
              <span className="font-semibold text-foreground">{report.action}</span>
            </div>
          </div>
        </div>

        {/* User Description Input */}
        <div className="space-y-2">
          <label 
            htmlFor="user-description" 
            className="text-xs font-bold text-foreground block uppercase tracking-wider"
          >
            What were you doing when this happened? (Optional)
          </label>
          <Textarea
            id="user-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. I was trying to save my cover letter to Google Drive but it failed. I just connected my Google account recently."
            className="min-h-[100px] text-sm rounded-none border-white/10 focus:border-primary/50 transition-colors placeholder:text-muted-foreground/50"
            disabled={submitting}
          />
        </div>

        {/* Stack Trace Collapsible */}
        {report.error_stack && (
          <div className="space-y-2 border border-white/5 bg-white/[0.02] p-3">
            <button
              type="button"
              onClick={() => setShowStack(!showStack)}
              className="w-full flex items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5" />
                {showStack ? "Hide" : "Show"} Technical Error Logs
              </span>
              <span>{showStack ? "▲" : "▼"}</span>
            </button>
            
            {showStack && (
              <pre className="text-[10px] text-muted-foreground bg-black/40 border border-white/5 p-3 overflow-x-auto max-h-48 font-mono leading-relaxed mt-2 whitespace-pre-wrap select-all">
                {report.error_stack}
              </pre>
            )}
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.history.back()}
            disabled={submitting}
            className="rounded-none text-xs font-semibold border-white/10 hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="rounded-none text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Submit Report
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function HelpCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
