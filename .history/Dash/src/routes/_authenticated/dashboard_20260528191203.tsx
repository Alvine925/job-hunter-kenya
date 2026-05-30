import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listJobs, getMyProfile, toggleSaveJob } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DashboardJobCard } from "@/components/dashboard/dashboard-job-card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  Sparkles,
  Search,
  Globe,
  ArrowUpRight,
  Activity,
  X,
  Calendar,
  ChevronDown,
  ArrowRight,
  FileText,
  Target,
  SlidersHorizontal,
} from "lucide-react";

import { DashboardSkeleton } from "@/components/ui/skeleton-loaders";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    title: "Dashboard - Tellus",
    meta: [
      { title: "Dashboard - Tellus" },
      { name: "description", content: "View your job search stats, pipeline status, referral program status, and top matching roles." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Background bulk logo population trigger (runs silently once when developer/user loads the dashboard)
  useEffect(() => {
    const triggerBulkLogos = async () => {
      try {
        console.log("[bulk-logo] Triggering background database logo resolution...");
        const { data, error } = await supabase.functions.invoke("company-logo", {
          body: { bulk: true },
        });
        if (error) throw error;
        console.log("[bulk-logo] Background database logo resolution complete:", data);

        // Invalidate queries so the fresh DB logo_urls load onto cards and rows instantly
        queryClient.invalidateQueries({ queryKey: ["jobs"] });
      } catch (err) {
        console.warn("[bulk-logo] Background logo resolution bypass/error:", err);
      }
    };
    triggerBulkLogos();
  }, [queryClient]);

  const { data, isLoading: isJobsLoading } = useQuery({ queryKey: ["jobs"], queryFn: () => listJobs() });
  const jobs = data?.jobs ?? [];
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterJobType, setFilterJobType] = useState("");
  const [filterSource, setFilterSource] = useState("");

  // Bookmark mutation
  const saveMutation = useMutation({
    mutationFn: (jobId: string) => toggleSaveJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["saved-jobs"] });
    },
  });

  // Unique filter values extracted from jobs data
  const uniqueJobTypes = useMemo(() => [...new Set(jobs.map((j: any) => j.job_type).filter(Boolean))].sort(), [jobs]);
  const uniqueSources = useMemo(() => [...new Set(jobs.map((j: any) => j.source).filter(Boolean))].sort(), [jobs]);

  // Profile data to greet by name
  const { data: profileData, isLoading: isProfileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: getMyProfile,
  });
  const name = profileData?.profile?.full_name || "Alvine";
  const firstName = name.split(" ")[0] || "Alvine";

  // Fetch referrals to calculate accurate active count
  const { data: referralsData = [] } = useQuery({
    queryKey: ["referrals"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("referrals")
        .select("id, status")
        .eq("status", "completed");
      if (error) throw error;
      return data ?? [];
    },
  });
  const activeReferralCount = referralsData.length;

  const high = jobs.filter((j: any) => (j.match_score ?? 0) >= 80);
  const inTracker = jobs.filter((j: any) => j.tracker_status !== "new").length;
  const pct = jobs.length ? ((high.length / jobs.length) * 100).toFixed(0) : 0;
  const sortedJobs = [...jobs].sort((a: any, b: any) => (b.match_score ?? 0) - (a.match_score ?? 0));

  // Filter logic
  const filteredJobs = useMemo(() => {
    let result = sortedJobs;

    // Apply dropdown filters
    if (filterJobType) {
      result = result.filter((j: any) => j.job_type === filterJobType);
    }
    if (filterSource) {
      result = result.filter((j: any) => j.source === filterSource);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((j: any) =>
        j.title?.toLowerCase().includes(q) ||
        j.company?.toLowerCase().includes(q) ||
        j.location?.toLowerCase().includes(q) ||
        j.county?.toLowerCase().includes(q) ||
        j.source?.toLowerCase().includes(q) ||
        j.job_type?.toLowerCase().includes(q)
      );
    } else if (!filterJobType && !filterSource) {
      // Only slice to 5 when there are no filters active
      result = result.slice(0, 5);
    }

    return result;
  }, [sortedJobs, searchQuery, filterJobType, filterSource]);

  if (isJobsLoading || isProfileLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] w-full">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1280px] mx-auto w-full">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  const activeFilterCount = (filterJobType ? 1 : 0) + (filterSource ? 1 : 0);

  // Circular gauge score calculation
  const scores = jobs.map((j: any) => j.match_score).filter((s: number) => typeof s === "number" && s > 0);
  const avgScore = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 85;

  // Donut chart calculations
  const totalJobsCount = jobs.length || 15;
  const highCount = jobs.length ? jobs.filter((j: any) => (j.match_score ?? 0) >= 80).length : 1;
  const mediumCount = jobs.length ? jobs.filter((j: any) => (j.match_score ?? 0) >= 50 && (j.match_score ?? 0) < 80).length : 4;
  const lowCount = jobs.length ? jobs.filter((j: any) => (j.match_score ?? 0) < 50).length : 10;

  const highPct = Math.round((highCount / totalJobsCount) * 100);
  const mediumPct = Math.round((mediumCount / totalJobsCount) * 100);
  const lowPct = Math.round((lowCount / totalJobsCount) * 100);

  const donutRadius = 38;
  const circumference = 2 * Math.PI * donutRadius;

  const highStroke = (highCount / totalJobsCount) * circumference;
  const mediumStroke = (mediumCount / totalJobsCount) * circumference;
  const lowStroke = (lowCount / totalJobsCount) * circumference;

  const highOffset = 0;
  const mediumOffset = highStroke;
  const lowOffset = highStroke + mediumStroke;

  const formattedDate = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] w-full">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1280px] mx-auto w-full space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1E293B] dark:text-white">
              Welcome back, {firstName}! 👋
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Here's what's happening with your job pipeline today.
            </p>
          </div>
          <button className="flex items-center gap-2 border border-[#E2E8F0] dark:border-border/40 bg-white dark:bg-card px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-muted/5 transition-colors text-foreground shadow-sm w-fit cursor-pointer">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>{formattedDate}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* ── Two-Column Split (Top Matches & Sidebar) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column – Top Matches */}
          <div className="lg:col-span-8 space-y-6">
            {/* ── Top Stats (Cardless / Background) ── */}
            <div className="border-b border-[#E2E8F0] dark:border-border/10 pb-6 mb-2">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* AI Insight Card Section */}
                <div className="lg:col-span-4 flex flex-col justify-between py-1 space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 bg-[#FFF0E8]/70 dark:bg-orange-500/10 px-2.5 py-1 rounded-full w-fit">
                      <Sparkles className="w-3 h-3 text-[#FD5D28]" />
                      <span className="text-[10px] font-bold text-[#FD5D28] tracking-wider uppercase">AI INSIGHT</span>
                    </div>
                    <h3 className="font-extrabold text-lg sm:text-xl text-[#1E293B] dark:text-white leading-tight">Great progress!</h3>
                    <p className="text-xs sm:text-[12px] text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                      You have <span className="font-extrabold text-[#FD5D28]">{high.length || 3} high-match opportunities</span> worth applying to this week.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate({ to: "/find-jobs" })}
                    className="flex items-center gap-1.5 bg-[#FD5D28] hover:bg-[#E04D1E] text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all w-fit shadow-md cursor-pointer"
                  >
                    <span>View Top Matches</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Grid of 4 Stats Columns */}
                <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Jobs Scraped Column */}
                  <div className="flex flex-col justify-between min-h-[125px] sm:border-l border-slate-200/60 dark:border-border/10 sm:pl-4 first:border-0 first:pl-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#FFF0E8] dark:bg-orange-500/10 flex items-center justify-center text-[#FD5D28] shrink-0">
                          <Search className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">Scraped</span>
                      </div>
                      <div className="mt-2">
                        <div className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-white leading-none">{jobs.length || 15}</div>
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mt-1">+5 this week</div>
                      </div>
                    </div>
                    <svg className="w-full h-6 mt-1" viewBox="0 0 100 28" preserveAspectRatio="none">
                      <path d="M0,24 C15,10 30,20 45,5 C60,16 75,8 100,18" fill="none" stroke="#FD5D28" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>

                  {/* Excellent Matches Column */}
                  <div className="flex flex-col justify-between min-h-[125px] sm:border-l border-slate-200/60 dark:border-border/10 sm:pl-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#E8F8F0] dark:bg-emerald-500/10 flex items-center justify-center text-[#10B981] shrink-0">
                          <Target className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">Excellent</span>
                      </div>
                      <div className="mt-2">
                        <div className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-white leading-none">{high.length || 1}</div>
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mt-1">
                          {jobs.length ? `${pct}% of total` : "7% of total"}
                        </div>
                      </div>
                    </div>
                    <svg className="w-full h-6 mt-1" viewBox="0 0 100 28" preserveAspectRatio="none">
                      <path d="M0,20 C20,26 40,8 60,16 C80,2 90,10 100,6" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>

                  {/* In Tracker Column */}
                  <div className="flex flex-col justify-between min-h-[125px] sm:border-l border-slate-200/60 dark:border-border/10 sm:pl-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#F3E8FF] dark:bg-violet-500/10 flex items-center justify-center text-[#8B5CF6] shrink-0">
                          <Briefcase className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">In Tracker</span>
                      </div>
                      <div className="mt-2">
                        <div className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-white leading-none">{inTracker}</div>
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mt-1">Roles in pipeline</div>
                      </div>
                    </div>
                    <div className="w-full h-1.5 mt-2 bg-slate-100 dark:bg-muted/20 rounded-full overflow-hidden">
                      <div className="h-full bg-[#8B5CF6] rounded-full transition-all" style={{ width: `${inTracker > 0 ? Math.min((inTracker / (jobs.length || 1)) * 100, 100) : 0}%` }} />
                    </div>
                  </div>

                  {/* Average Match Score Column */}
                  <div className="flex flex-col justify-between min-h-[125px] sm:border-l border-slate-200/60 dark:border-border/10 sm:pl-4">
                    <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-full text-left">Avg Score</span>

                    <div className="relative flex items-center justify-center my-1 shrink-0 self-start w-[48px] h-[48px]">
                      <svg className="w-[48px] h-[48px] transform -rotate-90">
                        <circle cx="24" cy="24" r="20" className="stroke-[#E2E8F0] dark:stroke-muted/20" strokeWidth="4.5" fill="transparent" />
                        <circle cx="24" cy="24" r="20" stroke="#3B82F6" strokeWidth="4.5" fill="transparent"
                          strokeDasharray={2 * Math.PI * 20}
                          strokeDashoffset={2 * Math.PI * 20 - (avgScore / 100) * (2 * Math.PI * 20)}
                          strokeLinecap="round"
                          className="transition-all"
                        />
                      </svg>
                      <span className="absolute text-[10px] font-black text-[#1E293B] dark:text-white">{avgScore}%</span>
                    </div>

                    <div className="text-[9px] text-[#10B981] font-bold flex items-center gap-0.5 shrink-0 self-start mt-1">
                      <span>↑ 12% vs last week</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column — aligned with stats on desktop */}
          <div className="lg:col-span-4 lg:row-span-2 space-y-6">
            {/* Referral Widget */}
            <div className="space-y-4 py-1">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#1E293B] dark:text-white text-[15px] tracking-tight">Refer a Friend</h3>
                <span className="text-[10px] font-bold bg-[#E0F2FE] text-[#0284C7] dark:bg-sky-500/10 dark:text-sky-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Plan: {profileData?.profile?.current_plan === "upgraded" ? "Upgraded" : "Free"}
                </span>
              </div>
              <div className="bg-white dark:bg-card border border-[#E2E8F0] dark:border-border/10 rounded-xl p-4 space-y-3 shadow-sm">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Invite friends to unlock upgraded limits (4 CV uploads/month, 4 packs/day) for 30 days.
                </p>
                {profileData?.profile?.referral_code ? (
                  <>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-slate-50 dark:bg-muted/10 border border-[#E2E8F0] dark:border-border/10 px-3 py-1.5 rounded-lg font-mono text-[11px] select-all truncate text-muted-foreground">
                        {window.location.origin}/login?ref={profileData.profile.referral_code}
                      </div>
                      <Button
                        size="sm"
                        className="h-8 shrink-0 px-3 cursor-pointer"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${window.location.origin}/login?ref=${profileData.profile.referral_code}`
                          );
                          toast.success("Referral link copied!");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-1 pt-1.5 border-t border-slate-100 dark:border-border/5">
                      <span className="text-muted-foreground">
                        Cycle progress: <strong>{profileData.profile.active_referrals ?? 0}/10</strong> referred
                      </span>
                      <Link to="/settings" className="text-primary font-bold hover:underline">
                        View stats →
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground italic py-1 animate-pulse">
                    Setting up referral code...
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions (Cardless) */}
            <div className="space-y-4 py-1">
              <h3 className="font-bold text-[#1E293B] dark:text-white text-[15px] tracking-tight">Quick Actions</h3>
              <div className="space-y-2.5">
                {[
                  { to: "/find-jobs", title: "Find Jobs", subtitle: "Browse all scraped positions", icon: Search, bg: "bg-[#FFF0E8]", text: "text-[#FD5D28]" },
                  { to: "/marketplace", title: "Marketplace", subtitle: "Scan public boards for openings", icon: Globe, bg: "bg-[#E0F2FE]", text: "text-[#0284C7]" },
                  { to: "/monitors", title: "Monitors", subtitle: "Manage career site monitors", icon: Activity, bg: "bg-[#E8F8F0]", text: "text-[#10B981]" },
                  { to: "/templates", title: "Templates", subtitle: "Edit AI application instructions", icon: FileText, bg: "bg-[#F3E8FF]", text: "text-[#8B5CF6]" },
                ].map((act, i) => {
                  const Icon = act.icon;
                  return (
                    <Link
                      key={i}
                      to={act.to}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/50 dark:bg-muted/10 border border-[#F1F5F9] dark:border-border/5 hover:bg-slate-50 dark:hover:bg-muted/20 hover:border-primary/10 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg shrink-0", act.bg, act.text)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-[#1E293B] dark:text-white leading-tight">{act.title}</h4>
                          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">{act.subtitle}</p>
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Pipeline at a glance (Cardless) */}
            <div className="space-y-4 pt-4 border-t border-[#E2E8F0] dark:border-border/10">
              <div>
                <h3 className="font-bold text-[#1E293B] dark:text-white text-[15px] tracking-tight">Pipeline at a glance</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Your pipeline activity overview</p>
              </div>

              {/* Donut + Legend */}
              <div className="flex items-center gap-4 py-1">
                {/* Donut chart */}
                <div className="relative shrink-0">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle cx="48" cy="48" r={donutRadius} fill="transparent" className="stroke-[#10B981]" strokeWidth="10"
                      strokeDasharray={`${highStroke} ${circumference}`} strokeDashoffset={-highOffset}
                    />
                    <circle cx="48" cy="48" r={donutRadius} fill="transparent" className="stroke-[#FD5D28]" strokeWidth="10"
                      strokeDasharray={`${mediumStroke} ${circumference}`} strokeDashoffset={-mediumOffset}
                    />
                    <circle cx="48" cy="48" r={donutRadius} fill="transparent" className="stroke-[#E2E8F0] dark:stroke-muted/20" strokeWidth="10"
                      strokeDasharray={`${lowStroke} ${circumference}`} strokeDashoffset={-lowOffset}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-extrabold text-[#1E293B] dark:text-white">{totalJobsCount}</span>
                    <span className="text-[8px] text-muted-foreground font-bold tracking-wider uppercase">Total</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex-1 space-y-1.5 text-[10px] sm:text-[11px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                      <span className="text-muted-foreground">High Match (≥80%)</span>
                    </div>
                    <span className="font-bold text-[#1E293B] dark:text-white">{highCount} ({highPct}%)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#FD5D28]" />
                      <span className="text-muted-foreground">Medium Match (50-79%)</span>
                    </div>
                    <span className="font-bold text-[#1E293B] dark:text-white">{mediumCount} ({mediumPct}%)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#E2E8F0] dark:bg-muted/40" />
                      <span className="text-muted-foreground">Low Match (&lt;50%)</span>
                    </div>
                    <span className="font-bold text-[#1E293B] dark:text-white">{lowCount} ({lowPct}%)</span>
                  </div>
                </div>
              </div>

              {/* Tip */}
              <div className="bg-[#F5F3FF] dark:bg-muted/10 border border-[#EDE9FE] dark:border-border/10 rounded-xl p-3.5 flex items-start justify-between gap-3 shadow-none">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6] dark:text-[#A78BFA] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[#5B21B6] dark:text-[#C084FC] font-medium leading-snug">
                    Improve your matches by updating your CV and application preferences.
                  </p>
                </div>
                <Link
                  to="/profile"
                  className="flex items-center gap-1 border border-[#DDD6FE] dark:border-border/20 bg-white dark:bg-card px-2.5 py-1 rounded-md text-[10px] font-bold hover:bg-slate-50 dark:hover:bg-muted/5 transition-colors text-[#5B21B6] dark:text-[#C084FC] shrink-0 animate-pulse"
                >
                  Update CV
                  <ChevronDown className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Top matches */}
          <div className="lg:col-span-8 w-full min-w-0 space-y-6">
            {/* Header row */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#1E293B] dark:text-white tracking-tight">Top matches</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Best matched scraped positions tailored for you</p>
              </div>
              <span className="text-xs bg-[#E8F8F0] text-[#10B981] dark:bg-emerald-500/10 dark:text-emerald-400 px-3 py-1 rounded-full font-bold w-fit">
                Score ≥ 80%
              </span>
            </div>

            {/* Search bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 transition-colors group-focus-within:text-[#FD5D28]" />
                <Input
                  type="text"
                  placeholder="Search by role, company, location, or source..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9 py-2.5 bg-white dark:bg-card border-[#E2E8F0] dark:border-border/10 focus-visible:ring-[#FD5D28]/20 focus-visible:border-[#FD5D28] rounded-lg text-xs sm:text-sm placeholder:text-muted-foreground/50 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground/50 hover:text-foreground rounded-full hover:bg-muted/10 transition-colors cursor-pointer"
                    type="button"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "flex items-center gap-2 border px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer shrink-0",
                  showFilters || activeFilterCount > 0
                    ? "border-[#FD5D28]/30 bg-[#FFF5F0] dark:bg-orange-500/10 text-[#FD5D28]"
                    : "border-[#E2E8F0] dark:border-border/10 bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted/5 text-foreground"
                )}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-[#FD5D28] text-white rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-3 py-3 px-1 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Job Type</label>
                  <select
                    value={filterJobType}
                    onChange={(e) => setFilterJobType(e.target.value)}
                    className="text-xs sm:text-sm border border-[#E2E8F0] dark:border-border/10 bg-white dark:bg-card rounded-lg px-3 py-1.5 text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FD5D28]/20 focus:border-[#FD5D28]"
                  >
                    <option value="">All Types</option>
                    {uniqueJobTypes.map((t: string) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Source</label>
                  <select
                    value={filterSource}
                    onChange={(e) => setFilterSource(e.target.value)}
                    className="text-xs sm:text-sm border border-[#E2E8F0] dark:border-border/10 bg-white dark:bg-card rounded-lg px-3 py-1.5 text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FD5D28]/20 focus:border-[#FD5D28]"
                  >
                    <option value="">All Sources</option>
                    {uniqueSources.map((s: string) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => { setFilterJobType(""); setFilterSource(""); }}
                    className="text-xs font-semibold text-[#FD5D28] hover:text-[#E04D1E] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {/* Job cards — full width of page content */}
            <div className="mt-4 w-full grid grid-cols-1">
              {filteredJobs.map((j: any) => {
                const location = [j.location, j.county].filter(Boolean).join(", ");
                return (
                  <DashboardJobCard
                    key={j.id}
                    job={j}
                    location={location}
                    onToggleSave={() => saveMutation.mutate(j.id)}
                    isSaving={saveMutation.isPending}
                  />
                );
              })}

              {/* Empty States */}
              {searchQuery && filteredJobs.length === 0 && (
                <div className="py-12 text-center text-muted-foreground space-y-2">
                  <Search className="w-6 h-6 text-muted-foreground/40 mx-auto" />
                  <h4 className="font-semibold text-foreground text-sm">No jobs match your search</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    We couldn't find any scraped jobs matching "{searchQuery}". Try refining your keywords.
                  </p>
                </div>
              )}

              {!searchQuery && jobs.length === 0 && (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  No matching jobs found yet. Go to{" "}
                  <Link to="/marketplace" className="text-[#FD5D28] hover:underline font-semibold inline-flex items-center gap-0.5">
                    Marketplace <ArrowUpRight className="w-3 h-3" />
                  </Link>{" "}
                  to discover new opportunities.
                </div>
              )}
            </div>

            {/* View all matches */}
            <div className="flex justify-center pt-6 pb-2">
              <Link
                to="/find-jobs"
                className="flex items-center justify-center gap-1.5 border border-[#E2E8F0] dark:border-border/10 text-foreground bg-white hover:bg-slate-50 dark:bg-[#1E293B] dark:hover:bg-[#2A3547] px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <span>View all matches</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
