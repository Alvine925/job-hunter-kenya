import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LearnMoreLink, LearnMoreSlider } from "@/components/cos/learn-more-slider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Building2,
  Calendar,
  Clock,
  ChevronRight,
  Info,
  RefreshCw,
  MailCheck,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Inbox
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/cos/follow-ups/")({
  head: () => ({
    title: "Follow-Ups CRM - Tellus",
    meta: [
      { title: "Follow-Ups CRM - Tellus" },
      { name: "description", content: "Professional email template engine and follow-up action planner for job seekers." },
    ],
  }),
  component: FollowUpsDashboard,
});

interface FollowUpJob {
  id: string;
  title: string;
  company: string;
  status: string;
  lastContact: string;
  daysIdle: number;
  contactPerson?: string;
  contactEmail?: string;
}

function FollowUpsDashboard() {
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);

  // Query actual user jobs from CRM
  const { data: jobsList = [], isLoading } = useQuery({
    queryKey: ["jobs-followups-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, company, location, tracker_status, contact_person, application_email, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((j: any) => ({
        id: j.id,
        title: j.title,
        company: j.company || "",
        status: j.tracker_status || "applied",
        lastContact: new Date(j.created_at).toISOString().split("T")[0],
        daysIdle: Math.max(0, Math.floor((new Date().getTime() - new Date(j.created_at).getTime()) / (1000 * 60 * 60 * 24))),
        contactPerson: j.contact_person || "Hiring Lead",
        contactEmail: j.application_email || "recruitment@company.com"
      }));
    }
  });

  // Derived statistics
  const totalJobs = jobsList.length;
  const needsCheckIn = jobsList.filter(j => j.daysIdle >= 7 && j.daysIdle < 14).length;
  const highlyUrgent = jobsList.filter(j => j.daysIdle >= 14).length;
  const actionRequired = needsCheckIn + highlyUrgent;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/40 dark:border-border/10 pb-6">
        <div>
          <h1 className="text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent flex items-center gap-1.5 select-none">
            <MailCheck className="w-5.5 h-5.5 sm:w-7 sm:h-7 text-[#FD5D28]" />
            Follow-Up Dashboard
          </h1>
          <p className="text-muted-foreground text-[10px] sm:text-sm mt-0.5 flex items-center gap-1.5 flex-wrap leading-relaxed">
            <span>CRM Communication & Follow-up Planner. Track idle times and launch template workspaces for your applications.</span>
            <LearnMoreLink onClick={() => setIsLearnMoreOpen(true)} />
          </p>
        </div>
      </div>

      {/* KPI Stats Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat Card 1 */}
        <div className="bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl p-4 sm:p-5 border border-slate-200/30 dark:border-border/5 space-y-1.5 sm:space-y-2">
          <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Tracked Pipeline</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-3xl font-black tracking-tight">{totalJobs}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold">Active Applications</span>
          </div>
        </div>

        {/* Stat Card 2 */}
        <div className="bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl p-4 sm:p-5 border border-slate-200/30 dark:border-border/5 space-y-1.5 sm:space-y-2">
          <span className="text-[10px] sm:text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            Attention Needed
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight">{needsCheckIn}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold">Idle 7+ days</span>
          </div>
        </div>

        {/* Stat Card 3 */}
        <div className="bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl p-4 sm:p-5 border border-slate-200/30 dark:border-border/5 space-y-1.5 sm:space-y-2">
          <span className="text-[10px] sm:text-xs font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Highly Urgent
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-3xl font-black text-rose-500 tracking-tight">{highlyUrgent}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold">Idle 14+ days</span>
          </div>
        </div>

        {/* Stat Card 4 */}
        <div className="bg-[#FD5D28]/5 rounded-2xl p-4 sm:p-5 border border-[#FD5D28]/10 space-y-1.5 sm:space-y-2">
          <span className="text-[10px] sm:text-xs font-bold text-[#FD5D28] uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            Urgency Rating
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-3xl font-black text-[#FD5D28] tracking-tight">
              {totalJobs > 0 ? `${Math.round((actionRequired / totalJobs) * 100)}%` : "0%"}
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold">Requires check-in</span>
          </div>
        </div>
      </div>

      {/* Main CRM Grid Panel */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-border/5 pb-2">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Needs Attention Pipeline</h2>
          <Badge className="font-extrabold text-[10px] bg-[#FD5D28]/10 text-[#FD5D28] border border-[#FD5D28]/15 hover:bg-[#FD5D28]/10 select-none">
            {totalJobs} Cards Total
          </Badge>
        </div>

        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#FD5D28]" />
            <p className="text-muted-foreground text-sm font-semibold">Loading CRM applications...</p>
          </div>
        ) : jobsList.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground/60 border border-dashed border-slate-200/40 dark:border-border/10 rounded-2xl bg-slate-50/20 dark:bg-slate-900/5">
            <Inbox className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="font-bold text-foreground text-base">Your CRM pipeline is empty</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-6">
              Track custom jobs or apply to opportunities in the marketplace to add them to your follow-up workspace pipeline.
            </p>
            <Button asChild className="bg-[#FD5D28] hover:bg-[#FD5D28]/95 text-white font-bold rounded-xl text-xs">
              <Link to="/marketplace">Explore Marketplace</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobsList.map((job) => {
              const isUrgent = job.daysIdle >= 14;
              const isWarning = job.daysIdle >= 7 && job.daysIdle < 14;
              
              return (
                <div
                  key={job.id}
                  className={cn(
                    "group relative bg-background rounded-2xl border p-5 transition-all flex flex-col justify-between min-h-[170px]",
                    isUrgent
                      ? "border-rose-500/20 hover:border-rose-500/40 shadow-sm shadow-rose-500/5 hover:shadow-md"
                      : isWarning
                        ? "border-amber-500/20 hover:border-amber-500/40 shadow-sm shadow-amber-500/5 hover:shadow-md"
                        : "border-slate-200/60 dark:border-border/10 hover:border-slate-300 dark:hover:border-border/30 hover:shadow-md"
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 max-w-[70%]">
                        <h4 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-[#FD5D28] transition-colors">
                          {job.title}
                        </h4>
                        <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          {job.company}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] font-extrabold uppercase shrink-0 py-0.5 select-none",
                          isUrgent
                            ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                            : isWarning
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : "bg-slate-100/50 dark:bg-slate-900 text-muted-foreground border-border/30"
                        )}
                      >
                        {isUrgent ? "highly urgent" : isWarning ? "needs attention" : job.status}
                      </Badge>
                    </div>

                    <p className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      Last contact: <span className="text-foreground">{job.lastContact}</span>
                      <span className="text-muted-foreground">({job.daysIdle} days idle)</span>
                    </p>
                  </div>

                  <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-border/5">
                    <div className="text-[10px] text-muted-foreground font-semibold">
                      Contact: <span className="text-foreground font-bold">{job.contactPerson || "Hiring Team"}</span>
                    </div>

                    <Link
                      to="/cos/follow-ups/$id"
                      params={{ id: job.id }}
                      search={{ tab: "check-in" }}
                      className="inline-flex items-center gap-1 text-[11px] text-[#FD5D28] hover:text-[#FD5D28]/95 font-bold transition-all"
                    >
                      Workspace
                      <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <LearnMoreSlider
        pageId="follow-ups"
        open={isLearnMoreOpen}
        onOpenChange={setIsLearnMoreOpen}
      />
    </div>
  );
}
