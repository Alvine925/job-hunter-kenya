import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCvPreviewUrl } from "@/lib/api";
import {
  ApplicationPreviewPanel,
  ExportButton,
  CopyAction,
  formatCoverLetterHtml,
  formatEmailHtml,
} from "./application-preview-panel";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CompanyLogo } from "./company-logo";
import {
  parseBulletLines,
  keywordMatchStats,
  youVoice,
  companyBlurb,
  roleDescriptionText,
} from "./utils";
import { SimilarJobsSection } from "./similar-jobs-section";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bookmark,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Columns2,
  ClipboardList,
  Copy,
  ExternalLink,
  FileCheck,
  FileText,
  Loader2,
  Mail,
  FolderOpen,
  MapPin,
  Phone,
  Sparkles,
  Send,
  Eye,
  X,
  Zap,
  XCircle,
  Building2,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sanitizePlainDocumentText } from "@/lib/sanitize-document-text";
import {
  driveFolderUrl,
  hasApplicationRecipientEmail,
  isPackSavedToDrive,
  normalizeApplyEmail,
} from "@/lib/application-email";
import { ApplyActionLoader } from "./apply-action-loader";
import { TypewriterLoader } from "./typewriter-loader";
import type { ApplyComposeView, ApplySection, JobDetailTab } from "./tab-search";
import { resolveApplySection } from "./tab-search";
import { ApplyComposeField } from "./apply-compose-field";
import { ManualApplyNotice } from "./manual-apply-notice";
import { JobCoachLauncher } from "./job-coach-launcher";
import { InterviewQuestionsSection } from "./interview-questions-section";
import { InterviewModeLauncher } from "./interview-mode-launcher";
import { InterviewReportSection } from "./interview-report-section";
import { parseInterviewQuestions } from "./interview-questions-section";
import { parsePackQuestions } from "./parse-pack";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type Job = Record<string, any>;
type Application = Record<string, any> | null;
type SimilarJob = {
  id: string;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  county?: string | null;
  match_score?: number | null;
  job_type?: string | null;
  source?: string | null;
  source_url?: string | null;
};

function SubjectTextArea({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      className={cn(
        "bg-transparent border-none outline-none p-0 py-1 min-h-[2rem] resize-none overflow-hidden text-[13px] sm:text-[14px] text-foreground w-full min-w-0 focus:ring-0 focus:outline-none",
        className
      )}
    />
  );
}

function MatchRing({ score, size = 56 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2;
  const strokeWidth = 4.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  let gradientId = `gradient-${score >= 80 ? "high" : score >= 60 ? "mid" : "low"}`;
  let trackColor = score >= 80
    ? "stroke-emerald-100 dark:stroke-emerald-950/20"
    : score >= 60
      ? "stroke-amber-100 dark:stroke-amber-950/20"
      : "stroke-rose-100 dark:stroke-rose-950/20";
  let textColor = score >= 80
    ? "text-emerald-600 dark:text-emerald-400"
    : score >= 60
      ? "text-amber-600 dark:text-amber-400"
      : "text-rose-600 dark:text-rose-400";
  let stops = score >= 80 ? (
    <>
      <stop offset="0%" stopColor="#10b981" />
      <stop offset="100%" stopColor="#059669" />
    </>
  ) : score >= 60 ? (
    <>
      <stop offset="0%" stopColor="#f97316" />
      <stop offset="100%" stopColor="#ea580c" />
    </>
  ) : (
    <>
      <stop offset="0%" stopColor="#f43f5e" />
      <stop offset="100%" stopColor="#e11d48" />
    </>
  );

  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {stops}
          </linearGradient>
          <filter id={`shadow-${gradientId}`} x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="0.8" floodOpacity="0.15" />
          </filter>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          filter={`url(#shadow-${gradientId})`}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className={cn("absolute inset-0 flex items-center justify-center font-bold tracking-tight", textColor)} style={{ fontSize: size * 0.26 }}>
        {score}%
      </span>
    </div>
  );
}

function FourDotsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <circle cx="7" cy="7" r="2" />
      <circle cx="17" cy="7" r="2" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

export function JobDetailView({
  job,
  application,
  tab,
  onTabChange,
  applyView = "both",
  onApplyViewChange,
  similarJobs = [],
  profileSkills,
  userFirstName,
  packMeta,
  isEmailApply,
  siteFormHint,
  siteEmailHint,
  to,
  cc,
  subject,
  body,
  letter,
  includeCv,
  onToChange,
  onCcChange,
  onSubjectChange,
  onBodyChange,
  onLetterChange,
  onIncludeCvChange,
  onApply,
  onPack,
  onInterviewGenerate,
  onInterviewReportRefresh,
  applySection,
  onApplySectionChange,
  applyPreviewOpen = false,
  onApplyPreviewOpenChange,
  interviewSheetOpen = false,
  onInterviewSheetOpenChange,
  onSave,
  onSend,
  onSaveToDrive,
  applyPending,
  applyDisabled = false,
  packPending,
  packDisabled = false,
  interviewPending = false,
  interviewDisabled = false,
  limitMessage,
  savePending,
  sendPending,
  saveToDrivePending = false,
  isSaved = false,
  onToggleSave,
  saveBookmarkPending = false,
  backTo = { to: "/find-jobs", label: "Jobs" },
  similarJobLink = "jobs",
  similarCurrentId,
  isSavingDraft = false,
  onToggleApplicationMethod,
  tailoredCv = "",
  onTailoredCvChange,
  isTailoringCv = false,
  onTailorCv,
}: {
  job: Job;
  application: Application;
  tab: JobDetailTab;
  onTabChange: (tab: JobDetailTab) => void;
  applyView?: ApplyComposeView;
  onApplyViewChange?: (view: ApplyComposeView) => void;
  similarJobs?: SimilarJob[];
  backTo?: { to: string; label: string };
  similarJobLink?: "jobs" | "marketplace";
  /** Defaults to job.id; marketplace passes scraped_jobs id */
  similarCurrentId?: string;
  profileSkills?: string[] | null;
  userFirstName?: string | null;
  packMeta: { keyFacts: { label: string; value: string }[]; siteProfileName: string | null };
  isEmailApply: boolean;
  siteFormHint: string | null;
  siteEmailHint: string | null;
  to: string;
  cc: string;
  subject: string;
  body: string;
  letter: string;
  includeCv: boolean;
  onToChange: (v: string) => void;
  onCcChange: (v: string) => void;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onLetterChange: (v: string) => void;
  onIncludeCvChange: (v: boolean) => void;
  onApply: () => void;
  onPack: () => void;
  onInterviewGenerate?: () => void;
  onInterviewReportRefresh?: () => void;
  applySection?: ApplySection;
  onApplySectionChange?: (section: ApplySection) => void;
  applyPreviewOpen?: boolean;
  onApplyPreviewOpenChange?: (open: boolean) => void;
  interviewSheetOpen?: boolean;
  onInterviewSheetOpenChange?: (open: boolean) => void;
  onSave: () => void;
  onSend: () => void;
  onSaveToDrive?: () => void;
  applyPending: boolean;
  applyDisabled?: boolean;
  packPending: boolean;
  packDisabled?: boolean;
  interviewPending?: boolean;
  interviewDisabled?: boolean;
  /** Human-readable message shown when generation limits are reached */
  limitMessage?: string;
  savePending: boolean;
  sendPending: boolean;
  saveToDrivePending?: boolean;
  isSaved?: boolean;
  onToggleSave?: () => void;
  saveBookmarkPending?: boolean;
  isSavingDraft?: boolean;
  onToggleApplicationMethod?: () => void;
  tailoredCv?: string;
  onTailoredCvChange?: (v: string) => void;
  isTailoringCv?: boolean;
  onTailorCv?: () => void;
}) {
  const [localMethodOverride, setLocalMethodOverride] = useState<"email" | "form" | null>(null);
  const displayEmailApply = localMethodOverride 
    ? localMethodOverride === "email" 
    : isEmailApply;

  const requirements = parseBulletLines(job.requirements);
  const responsibilities = parseBulletLines(job.responsibilities);
  const strengths = parseBulletLines(youVoice(job.match_strengths));
  const gaps = parseBulletLines(youVoice(job.match_gaps));
  const matchReason = youVoice(job.match_reason);
  const aboutCompany = companyBlurb(job);
  const roleDescription = roleDescriptionText(job);
  const roleParagraphs = roleDescription.split(/\n\n+/).filter(Boolean);
  const score = job.match_score ?? 0;
  const locationLabel = [job.location, job.county].filter(Boolean).join(", ");

  const jobText = [job.description, job.requirements, job.responsibilities].filter(Boolean).join(" ");
  const keywords = keywordMatchStats(profileSkills, jobText);
  const skillTags = extractSkillTags(job.requirements, job.description);

  const applyLabel = application?.status === "sent"
    ? `Applied ${application.sent_at ? new Date(application.sent_at).toLocaleDateString() : ""}`
    : application?.cover_letter || application?.pack_questions
      ? "Draft ready"
      : null;



  const activeApplySection = resolveApplySection(applySection);
  const activeSectionInfo = (() => {
    switch (activeApplySection) {
      case "matching":
        return { label: "Match Analysis", icon: BarChart3 };
      case "qualifications":
        return { label: "Qualifications", icon: FileCheck };
      case "interview":
        return { label: "Interview Prep", icon: ClipboardList };
      case "application":
      default:
        return { label: "Application", icon: Mail };
    }
  })();
  const ActiveIcon = activeSectionInfo.icon;

  return (
    <div
      className={cn(
        "flex flex-col h-full min-h-0 overflow-hidden",
        tab === "apply"
          ? (applyPreviewOpen ? "bg-background" : "apply-compose-root")
          : "bg-muted/40",
      )}
    >
      {/* Desktop Header */}
      <div
        className={cn(
          "hidden md:block border-b bg-background z-20 shrink-0",
          tab !== "apply" && "sticky top-0",
        )}
      >
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Top Row for Mobile: Back button + Action Buttons */}
          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <Link
              to={backTo.to}
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" /> {backTo.label}
            </Link>

            {/* Mobile Actions */}
            <div className="flex sm:hidden items-center gap-2 shrink-0">
              {applyLabel && (
                <Badge variant="secondary" className="font-normal text-[11px] px-2 py-0.5">
                  {applyLabel}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5"
                disabled={!onToggleSave || saveBookmarkPending}
                onClick={() => onToggleSave?.()}
              >
                <Bookmark
                  className={cn(
                    "w-3.5 h-3.5",
                    isSaved && "fill-primary text-primary",
                    saveBookmarkPending && "opacity-50",
                  )}
                />
              </Button>
              {tab !== "apply" && (
                <Button
                  size="sm"
                  className="h-8 px-3 gap-1"
                  disabled={applyPending || applyDisabled}
                  onClick={() => {
                    onTabChange("apply");
                    if (displayEmailApply && onApply && !application?.cover_letter && !body) {
                      onApply();
                    }
                  }}
                >
                  {applyPending && displayEmailApply ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5" />
                  )}
                  <span>Apply</span>
                </Button>
              )}
            </div>
          </div>

          {/* Bottom Row/Section for Tabs */}
          <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-4 sm:gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 -mx-4 sm:mx-0 px-4 sm:px-0">
            <div className="flex gap-1 items-center">
              {tab === "apply" && (
                <div className="inline-flex sm:hidden mr-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 -mb-[11px] rounded-none border-b-2 border-transparent hover:border-border text-muted-foreground hover:text-foreground focus:ring-0 focus-visible:ring-0 cursor-pointer"
                      >
                        <FourDotsIcon className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44 z-[100]">
                      <DropdownMenuItem onClick={() => onTabChange("overview")} className="cursor-pointer">
                        Overview
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onTabChange("company")} className="cursor-pointer">
                        Company
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onApplySectionChange?.("interview")}
                        className="cursor-pointer"
                      >
                        Interview prep
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              {(["overview", "company", "apply"] as const).map((t) => {
                const isHiddenOnMobileApply = tab === "apply" && t !== "apply";
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onTabChange(t)}
                    className={cn(
                      "px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium capitalize border-b-2 -mb-[11px] sm:-mb-px transition-colors",
                      tab === t
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                      isHiddenOnMobileApply && "hidden sm:inline-flex"
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            {/* Desktop Actions */}
            <div className="hidden sm:flex items-center gap-2 shrink-0 sm:ml-auto">
              {applyLabel && (
                <Badge variant="secondary" className="font-normal">
                  {applyLabel}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={!onToggleSave || saveBookmarkPending}
                onClick={() => onToggleSave?.()}
              >
                <Bookmark
                  className={cn(
                    "w-4 h-4",
                    isSaved && "fill-primary text-primary",
                    saveBookmarkPending && "opacity-50",
                  )}
                />
                <span className="hidden sm:inline ml-1">
                  {isSaved ? "Saved" : "Save"}
                </span>
              </Button>
              {tab !== "apply" && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={applyPending || applyDisabled}
                  onClick={() => {
                    onTabChange("apply");
                    if (displayEmailApply && onApply && !application?.cover_letter && !body) {
                      onApply();
                    }
                  }}
                >
                  {applyPending && displayEmailApply ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  Apply
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Custom Mobile Header */}
      <div className="md:hidden flex flex-col border-b border-border/40 bg-[#F8FAFC] dark:bg-[#0B0F19] sticky top-0 z-40 w-full shrink-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3 w-full">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer focus-visible:ring-0"
              onClick={() => window.dispatchEvent(new CustomEvent("toggle-mobile-sidebar"))}
            >
              <Menu className="h-5 w-5 animate-none" />
            </Button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#FD5D28]/10 text-[#FD5D28]">
              <ActiveIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{activeSectionInfo.label}</span>
            </div>
          </div>

          {job.source_url ? (
            <a
              href={job.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-bold border border-border/60 hover:bg-muted/45 text-muted-foreground hover:text-foreground cursor-pointer transition-colors shrink-0"
            >
              <ExternalLink className="w-3 h-3 mr-1 shrink-0" />
              <span>Open form</span>
            </a>
          ) : (
            onToggleApplicationMethod && (
              <button
                type="button"
                onClick={() => {
                  setLocalMethodOverride(displayEmailApply ? "form" : "email");
                  onToggleApplicationMethod?.();
                }}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-bold border border-border/60 hover:bg-muted/45 text-muted-foreground hover:text-foreground cursor-pointer transition-colors shrink-0"
              >
                <span>
                  Switch to {displayEmailApply ? "Form" : "Email"}
                </span>
              </button>
            )
          )}
        </div>

        {/* Tab row for mobile navigation */}
        <div className="flex items-center gap-1 px-4 border-t border-border/10 bg-background overflow-x-auto scrollbar-none w-full">
          {(["overview", "company", "apply"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={cn(
                "px-3.5 pb-2 pt-2.5 text-xs font-bold border-b-2 transition-all relative select-none cursor-pointer",
                tab === t
                  ? "border-[#FD5D28] text-[#FD5D28]"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onTabChange(t)}
            >
              <span className="capitalize">{t}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden bg-muted/10",
          tab !== "overview" && "hidden",
        )}
      >
        {/* Main Description Column */}
        <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 space-y-8 bg-background rounded-none border-x-0 border-t-0 sm:rounded-xl sm:border border-border/60 lg:rounded-none lg:border-0 lg:h-full lg:overflow-y-auto">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-start">
            <CompanyLogo
              company={job.company ?? "Company"}
              source={job.source}
              sourceUrl={job.source_url}
              logoUrl={job.logo_url}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              {job.job_type && (
                <span className="text-sm font-semibold text-violet-700">{job.job_type}</span>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1 leading-snug">
                {job.title}
              </h1>
              <p className="mt-2 text-base font-semibold text-foreground/90">
                {job.company ?? "Company"}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {locationLabel && (
                  <span className="inline-flex items-center gap-1.5 text-sky-700 font-medium">
                    <MapPin className="w-3.5 h-3.5" />
                    {locationLabel}
                  </span>
                )}
                {job.deadline && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    Deadline {new Date(job.deadline).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </span>
                )}
                {job.source && (
                  <span className="text-muted-foreground">via {job.source}</span>
                )}
                {job.source_url && (
                  <a
                    href={job.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
                  >
                    Original listing <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              {(job.salary_text || job.salary_min || job.salary_max) && (
                <p className="mt-3 text-lg font-bold text-foreground">
                  {job.salary_text ||
                    [job.salary_min && `KSh ${job.salary_min.toLocaleString()}`, job.salary_max && `– ${job.salary_max.toLocaleString()}`]
                      .filter(Boolean)
                      .join(" ")}
                </p>
              )}
            </div>
          </div>

          {skillTags.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Skills mentioned
              </h3>
              <div className="flex flex-wrap gap-2">
                {skillTags.map((s) => (
                  <Badge key={s} variant="secondary" className="font-normal">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="w-full space-y-8">
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Job description</h2>
              </div>
              {roleParagraphs.length > 0 ? (
                <div className="space-y-4 text-sm sm:text-[0.95rem] leading-relaxed text-foreground/90">
                  {roleParagraphs.map((para, i) => (
                    <p key={i} className="whitespace-pre-wrap">
                      {para.replace(/^•\s*/gm, "").trim()}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We don&apos;t have a clean description for this listing yet — it may be a LinkedIn
                  search page rather than one job.{" "}
                  {job.source_url && (
                    <a
                      href={job.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary font-medium hover:underline"
                    >
                      View the original posting
                    </a>
                  )}{" "}
                  or scrape again after enabling only Kenyan job boards in Configuration.
                </p>
              )}
            </section>

            {requirements.length > 0 && (
              <section>
                <h3 className="text-base font-bold text-foreground mb-3">Requirements</h3>
                <ul className="space-y-2 text-sm text-foreground/90">
                  {requirements.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {responsibilities.length > 0 && (
              <section>
                <h3 className="text-base font-bold text-foreground mb-3">Responsibilities</h3>
                <ul className="space-y-2 text-sm text-foreground/90">
                  {responsibilities.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="text-sm text-muted-foreground leading-relaxed border-t border-border/60 pt-6">
              {aboutCompany}
            </p>
          </div>

          {/* Mobile-only AI Match Section */}
          <div className="lg:hidden space-y-6 border-t border-border/60 pt-8 mt-8">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <MatchRing score={score} size={60} />
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                    AI Evaluation
                  </div>
                  <h3 className="font-bold text-lg text-foreground tracking-tight">How you match</h3>
                </div>
              </div>

              <p className="text-sm text-foreground/80 leading-relaxed font-normal">{matchReason}</p>
            </div>

            {(strengths.length > 0 || gaps.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-border/40">
                {strengths.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      Your strengths
                    </div>
                    <ul className="space-y-2">
                      {strengths.map((s, i) => (
                        <li key={i} className="text-sm flex gap-2 text-foreground/80 leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {gaps.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-[10px] font-bold tracking-widest uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      Gaps to address
                    </div>
                    <ul className="space-y-2">
                      {gaps.map((g, i) => (
                        <li key={i} className="text-sm flex gap-2 text-foreground/80 leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 shrink-0" />
                          <span>{g}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {keywords.total > 0 && (
              <button
                type="button"
                className="w-full flex items-center gap-4 group pt-4 border-t border-border/40 text-left"
                onClick={() =>
                  toast.message(
                    `${keywords.found} of ${keywords.total} skills from your profile appear in this posting`,
                  )
                }
              >
                <MatchRing score={Math.round((keywords.found / keywords.total) * 100)} size={52} />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="font-bold text-sm text-foreground tracking-tight flex items-center gap-1">
                    Keyword match
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {keywords.found} of {keywords.total} of your skills found
                  </div>
                </div>
              </button>
            )}
          </div>

          <SimilarJobsSection
            jobs={similarJobs}
            currentId={similarCurrentId ?? job.id}
            linkTo={similarJobLink}
          />
        </div>

        {/* Right Column / Sidebar */}
        <aside className="hidden lg:block order-2 lg:order-none min-w-0 w-full lg:w-[360px] shrink-0 p-4 sm:p-5 lg:px-5 lg:py-6 bg-transparent lg:h-full lg:overflow-y-auto">
          <div className="space-y-6">
            {/* How you match */}
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <MatchRing score={score} size={60} />
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                    AI Evaluation
                  </div>
                  <h3 className="font-bold text-lg text-foreground tracking-tight">How you match</h3>
                </div>
              </div>

              <p className="text-sm text-foreground/80 leading-relaxed font-normal">{matchReason}</p>
            </div>

            {(strengths.length > 0 || gaps.length > 0) && (
              <div className="space-y-5 pt-2 border-t border-border/40">
                {strengths.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      Your strengths
                    </div>
                    <ul className="space-y-2">
                      {strengths.map((s, i) => (
                        <li key={i} className="text-sm flex gap-2 text-foreground/80 leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {gaps.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-[10px] font-bold tracking-widest uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      Gaps to address
                    </div>
                    <ul className="space-y-2">
                      {gaps.map((g, i) => (
                        <li key={i} className="text-sm flex gap-2 text-foreground/80 leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 shrink-0" />
                          <span>{g}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Keyword match */}
            {keywords.total > 0 && (
              <button
                type="button"
                className="w-full flex items-center gap-4 group pt-4 border-t border-border/40 text-left"
                onClick={() =>
                  toast.message(
                    `${keywords.found} of ${keywords.total} skills from your profile appear in this posting`,
                  )
                }
              >
                <MatchRing score={Math.round((keywords.found / keywords.total) * 100)} size={52} />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="font-bold text-sm text-foreground tracking-tight flex items-center gap-1">
                    Keyword match
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {keywords.found} of {keywords.total} of your skills found
                  </div>
                </div>
              </button>
            )}
          </div>
        </aside>

        <JobCoachLauncher
          jobId={job.id}
          jobTitle={job.title ?? "this role"}
          userFirstName={userFirstName}
        />
      </div>

      <div
        className={cn(
          "flex-1 min-h-0 overflow-y-auto bg-transparent",
          tab !== "company" && "hidden",
        )}
      >
        <div className="max-w-4xl mx-auto p-4 sm:p-10 space-y-6 sm:space-y-10">
          {/* Header / Info Row */}
          <div className="flex flex-col md:flex-row gap-4 sm:gap-6 md:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-start w-full min-w-0">
              <div className="p-2 sm:p-3 bg-background rounded-xl sm:rounded-2xl border border-border/50 shadow-sm shrink-0">
                <CompanyLogo company={job.company ?? "Company"} source={job.source} sourceUrl={job.source_url} logoUrl={job.logo_url} size="lg" />
              </div>
              <div className="space-y-1.5 min-w-0 flex-1">
                <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight text-foreground break-words">{job.company ?? "Company"}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    {job.location ?? job.county ?? "Kenya"}
                  </span>
                  {job.category && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-border shrink-0" />
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        {job.category}
                      </span>
                    </>
                  )}
                  {job.source && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-border shrink-0" />
                      <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        via {job.source}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {job.source_url && (
              <a
                href={job.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg sm:rounded-xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm hover:opacity-90 transition shadow-sm self-start md:self-auto"
              >
                View company profile <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Split Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 pt-6 sm:pt-8 border-t border-border/60">
            {/* Left Column: Description & Recruitment Info */}
            <div className="md:col-span-2 space-y-6 sm:space-y-8">
              {/* About Employer */}
              <div className="space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-foreground">About the Employer</h3>
                <p className="text-sm sm:text-base leading-relaxed text-foreground/80 font-normal whitespace-pre-line">
                  {aboutCompany}
                </p>

                {job.source_url && (
                  <p className="text-[11px] sm:text-xs text-muted-foreground">
                    Role details and application are on the{" "}
                    <a
                      href={job.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary font-medium hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      original listing
                    </a>
                    .
                  </p>
                )}
              </div>

              {/* Recruitment Insights */}
              <div className="space-y-3 pt-4 border-t border-border/40">
                <h3 className="text-base sm:text-lg font-bold text-foreground">Recruitment Insights</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 rounded-xl bg-background border border-border/40 space-y-1 shadow-sm">
                    <div className="text-[9px] sm:text-[10px] font-bold tracking-wider uppercase text-muted-foreground">Postings Status</div>
                    <div className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active recruitment
                    </div>
                  </div>
                  <div className="p-3 sm:p-4 rounded-xl bg-background border border-border/40 space-y-1 shadow-sm">
                    <div className="text-[9px] sm:text-[10px] font-bold tracking-wider uppercase text-muted-foreground">Verification</div>
                    <div className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      Verified employer
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Key Stats & Contact Details */}
            <div className="space-y-8">
              {/* Company Stats */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Company Stats</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-border/30">
                    <span className="text-muted-foreground">Location</span>
                    <span className="font-semibold text-foreground">{job.location ?? job.county ?? "Kenya"}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/30">
                    <span className="text-muted-foreground">Sector</span>
                    <span className="font-semibold text-foreground">{job.category ?? "General"}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/30">
                    <span className="text-muted-foreground">Job Type</span>
                    <span className="font-semibold text-foreground">{job.job_type ?? "Full-time"}</span>
                  </div>
                  {job.salary_text && (
                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Salary</span>
                      <span className="font-semibold text-primary">{job.salary_text}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact and apply */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Contact & Apply</h3>
                <div className="space-y-4 text-sm">
                  {job.contact_person && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-background border border-border/40 flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">Contact Person</div>
                        <div className="font-medium text-foreground mt-0.5">{job.contact_person}</div>
                      </div>
                    </div>
                  )}
                  {job.application_email && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-background border border-border/40 flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
                        <Mail className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">Email Address</div>
                        <div className="mt-0.5">
                          <a href={`mailto:${job.application_email}`} className="font-medium text-primary hover:underline">
                            {job.application_email}
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                  {job.contact_phone && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-background border border-border/40 flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
                        <Phone className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">Phone Number</div>
                        <div className="font-medium text-foreground mt-0.5">{job.contact_phone}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex flex-1 min-h-0 flex-col overflow-hidden",
          tab !== "apply" && "hidden",
        )}
      >
        <ApplyPanel
          job={job}
          profileSkills={profileSkills}
          application={application}
          applyView={applyView}
          onApplyViewChange={onApplyViewChange}
          isEmailApply={displayEmailApply}
          siteFormHint={siteFormHint}
          siteEmailHint={siteEmailHint}
          packMeta={packMeta}
          to={to}
          cc={cc}
          subject={subject}
          body={body}
          letter={letter}
          tailoredCv={tailoredCv}
          includeCv={includeCv}
          onToChange={onToChange}
          onCcChange={onCcChange}
          onSubjectChange={onSubjectChange}
          onBodyChange={onBodyChange}
          onLetterChange={onLetterChange}
          onTailoredCvChange={onTailoredCvChange}
          onIncludeCvChange={onIncludeCvChange}
          onApply={onApply}
          onPack={onPack}
          onToggleApplicationMethod={() => {
            setLocalMethodOverride(displayEmailApply ? "form" : "email");
            onToggleApplicationMethod?.();
          }}
          onInterviewGenerate={onInterviewGenerate}
          onInterviewReportRefresh={onInterviewReportRefresh}
          applySection={applySection}
          onApplySectionChange={onApplySectionChange}
          applyPreviewOpen={applyPreviewOpen}
          onApplyPreviewOpenChange={onApplyPreviewOpenChange}
          interviewSheetOpen={interviewSheetOpen}
          onInterviewSheetOpenChange={onInterviewSheetOpenChange}
          onSave={onSave}
          onSend={onSend}
          isTailoringCv={isTailoringCv}
          onTailorCv={onTailorCv}
          applyPending={applyPending}
          applyDisabled={applyDisabled}
          packPending={packPending}
          packDisabled={packDisabled}
          interviewPending={interviewPending}
          interviewDisabled={interviewDisabled}
          limitMessage={limitMessage}
          savePending={savePending}
          sendPending={sendPending}
          onSaveToDrive={onSaveToDrive}
          saveToDrivePending={saveToDrivePending}
          isSavingDraft={isSavingDraft}
        />
      </div>
    </div>
  );
}

function extractSkillTags(requirements?: string | null, description?: string | null): string[] {
  const text = `${requirements ?? ""} ${description ?? ""}`;
  const common = [
    "SQL",
    "Excel",
    "Python",
    "Project Management",
    "Communication",
    "Leadership",
    "Data Analysis",
    "Microsoft Office",
    "Stakeholder Management",
    "Budgeting",
    "HR",
    "Sales",
    "Marketing",
    "Accounting",
    "NGO",
  ];
  return common.filter((s) => text.toLowerCase().includes(s.toLowerCase())).slice(0, 12);
}

function ApplyPanel(props: {
  job: Job;
  profileSkills?: string[] | null;
  application: Application;
  applyView: ApplyComposeView;
  onApplyViewChange?: (view: ApplyComposeView) => void;
  isEmailApply: boolean;
  siteFormHint: string | null;
  siteEmailHint: string | null;
  packMeta: { keyFacts: { label: string; value: string }[]; siteProfileName: string | null };
  to: string;
  cc: string;
  subject: string;
  body: string;
  letter: string;
  tailoredCv: string;
  includeCv: boolean;
  onToChange: (v: string) => void;
  onCcChange: (v: string) => void;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onLetterChange: (v: string) => void;
  onTailoredCvChange?: (v: string) => void;
  onIncludeCvChange: (v: boolean) => void;
  onApply: () => void;
  onPack: () => void;
  onInterviewGenerate?: () => void;
  onInterviewReportRefresh?: () => void;
  applySection?: ApplySection;
  onApplySectionChange?: (section: ApplySection) => void;
  applyPreviewOpen?: boolean;
  onApplyPreviewOpenChange?: (open: boolean) => void;
  interviewSheetOpen?: boolean;
  onInterviewSheetOpenChange?: (open: boolean) => void;
  onSave: () => void;
  onSend: () => void;
  onSaveToDrive?: () => void;
  applyPending: boolean;
  applyDisabled?: boolean;
  packPending: boolean;
  packDisabled?: boolean;
  interviewPending?: boolean;
  interviewDisabled?: boolean;
  limitMessage?: string;
  savePending: boolean;
  sendPending: boolean;
  saveToDrivePending?: boolean;
  userFirstName?: string | null;
  isSavingDraft?: boolean;
  onToggleApplicationMethod?: () => void;
  isTailoringCv?: boolean;
  onTailorCv?: () => void;
}) {
  const {
    job,
    application: app,
    applyView,
    onApplyViewChange,
    applySection,
    onApplySectionChange,
    applyPreviewOpen = false,
    onApplyPreviewOpenChange,
    interviewSheetOpen = false,
    onInterviewSheetOpenChange,
    isEmailApply,
    siteFormHint,
    siteEmailHint,
    packMeta,
    to,
    cc,
    subject,
    body,
    letter,
    tailoredCv,
    includeCv,
    onToChange,
    onCcChange,
    onSubjectChange,
    onBodyChange,
    onLetterChange,
    onTailoredCvChange,
    onIncludeCvChange,
    onApply,
    onPack,
    onInterviewGenerate,
    onInterviewReportRefresh,
    onSave,
    onSend,
    onSaveToDrive,
    applyPending,
    applyDisabled = false,
    packPending,
    packDisabled = false,
    interviewPending = false,
    interviewDisabled = false,
    limitMessage,
    savePending,
    sendPending,
    saveToDrivePending = false,
    isSavingDraft = false,
    onToggleApplicationMethod,
    isTailoringCv = false,
    onTailorCv,
  } = props;

  const [headersCollapsed, setHeadersCollapsed] = useState(false);
  const editPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      const isInsidePanel = editPanelRef.current?.contains(target);
      if (!isInsidePanel && target !== editPanelRef.current) return;

      const isScrolled = target.scrollTop > 45;
      setHeadersCollapsed((prev) => (prev !== isScrolled ? isScrolled : prev));
    };

    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, []);

  const previewOpen = applyPreviewOpen;
  const setPreviewOpen = (open: boolean) => onApplyPreviewOpenChange?.(open);
  const emailDraftReady = !!(app?.cover_letter || body?.trim());
  const activeApplySection = resolveApplySection(applySection);

  const interviewQuestions = parseInterviewQuestions(app?.interview_questions);
  const hasPrepQuestions = interviewQuestions.length >= 3;
  const prepQuestionsCount = interviewQuestions.length;

  // Derived data for matching-analysis & qualifications sections
  const strengths = parseBulletLines(youVoice(job.match_strengths));
  const gaps = parseBulletLines(youVoice(job.match_gaps));
  const matchReason = youVoice(job.match_reason);
  const score = job.match_score ?? 0;
  const requirements = parseBulletLines(job.requirements);
  const responsibilities = parseBulletLines(job.responsibilities);
  const jobText = [job.description, job.requirements, job.responsibilities].filter(Boolean).join(" ");
  const skillTags = extractSkillTags(job.requirements, job.description);
  const keywords = keywordMatchStats(props.profileSkills, jobText);
  const locationLabel = [job.location, job.county].filter(Boolean).join(", ");

  const hasUnsavedChanges = !!app?.id && (
    subject !== (app.email_subject ?? "") ||
    body !== (app.email_body ?? "") ||
    sanitizePlainDocumentText(letter) !== sanitizePlainDocumentText(app.cover_letter ?? "") ||
    to !== (app.application_email ?? "")
  );

  useEffect(() => {
    if (previewOpen && !emailDraftReady) onApplyPreviewOpenChange?.(false);
  }, [previewOpen, emailDraftReady, onApplyPreviewOpenChange]);

  const { data: cvPreview, isLoading: cvLoading } = useQuery({
    queryKey: ["cv-preview"],
    queryFn: getCvPreviewUrl,
    enabled: previewOpen,
    staleTime: 300_000,
  });

  const listingEmail =
    normalizeApplyEmail(job.application_email) ?? normalizeApplyEmail(app?.application_email);
  const canSendAutomatically = hasApplicationRecipientEmail(
    job.application_email,
    app?.application_email,
    to,
  );
  const packSavedToDrive = isPackSavedToDrive(app) || !!app?.drive_folder_id;
  const savedFolderUrl = driveFolderUrl(app?.drive_folder_id);
  const applyActionBusy = saveToDrivePending || sendPending;
  const docUrl = app?.drive_file_id
    ? `https://docs.google.com/document/d/${app.drive_file_id}/edit`
    : null;

  const [isLargeScreen, setIsLargeScreen] = useState(true);
  const [mobileTab, setMobileTab] = useState<"email" | "letter">("email");
  const [mobileExpanded, setMobileExpanded] = useState<"email" | "letter" | null>("email");

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    setIsLargeScreen(media.matches);
    const listener = (e: MediaQueryListEvent) => setIsLargeScreen(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  // Match analysis & qualifications are allowed on mobile as well
  /*
  useEffect(() => {
    if (!onApplySectionChange) return;
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => {
      if (
        mq.matches &&
        (activeApplySection === "matching" || activeApplySection === "qualifications")
      ) {
        onApplySectionChange("application");
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [activeApplySection, onApplySectionChange]);
  */

  const showEmail = applyView === "email" || (applyView === "both" && (isLargeScreen || mobileTab === "email"));
  const showLetter = applyView === "letter" || (applyView === "both" && (isLargeScreen || mobileTab === "letter"));
  const singlePanel = applyView !== "both" || !isLargeScreen;

  const setView = (view: ApplyComposeView) => onApplyViewChange?.(view);

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      {onApplySectionChange && (
        <div className="shrink-0 border-b border-border/10 bg-background w-full">
          {/* Desktop sub-navigation */}
          <div className="hidden md:flex max-w-7xl mx-auto w-full flex-row items-center justify-between gap-3 px-8 py-2 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none whitespace-nowrap">
              {[
                { id: "application", label: "Application", icon: Mail },
                { id: "matching", label: "Match Analysis", icon: BarChart3 },
                { id: "qualifications", label: "Qualifications", icon: FileCheck },
                { id: "interview", label: "Interview Prep", icon: ClipboardList },
              ].map((section) => {
                const Icon = section.icon;
                const active = activeApplySection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => onApplySectionChange(section.id as ApplySection)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer select-none shrink-0",
                      active
                        ? "bg-[#FD5D28]/10 text-[#FD5D28] shadow-sm shadow-[#FD5D28]/5"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </div>
            {onToggleApplicationMethod && (
              <button
                type="button"
                onClick={onToggleApplicationMethod}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border border-border/60 hover:bg-muted/45 text-muted-foreground hover:text-foreground cursor-pointer transition-colors shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#FD5D28] shrink-0" />
                <span>
                  Switch to {isEmailApply ? "Form application" : "Email application"}
                </span>
              </button>
            )}
          </div>

          {/* Mobile sub-navigation (4-column grid with stacked icon above text) */}
          <div className="md:hidden grid grid-cols-4 border-b border-border/40 bg-background w-full">
            {[
              { id: "application", label: "Application", icon: Mail },
              { id: "matching", label: "Match Analysis", icon: BarChart3 },
              { id: "qualifications", label: "Qualifications", icon: FileCheck },
              { id: "interview", label: "Interview Prep", icon: ClipboardList },
            ].map((section) => {
              const Icon = section.icon;
              const active = activeApplySection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onApplySectionChange(section.id as ApplySection)}
                  className={cn(
                    "flex flex-col items-center justify-center py-2.5 px-1 gap-1 text-[10px] sm:text-xs font-bold transition-all relative select-none cursor-pointer border-b-[2.5px]",
                    active
                      ? "border-[#FD5D28] text-[#FD5D28]"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/10",
                  )}
                >
                  <Icon className={cn("w-4.5 h-4.5 shrink-0 mb-0.5", active ? "text-[#FD5D28]" : "text-muted-foreground")} />
                  <span className="truncate max-w-full leading-none">{section.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        ref={editPanelRef}
        className={cn(
          "flex-1 min-h-0",
          previewOpen
            ? "flex flex-col overflow-y-auto sm:overflow-hidden pb-4"
            : "overflow-y-auto overscroll-contain pb-8",
          !previewOpen && !singlePanel && isEmailApply && "lg:overflow-hidden",
          activeApplySection !== "application" && "hidden",
        )}
      >
        <div
          className={cn(
            "w-full h-full flex flex-col min-w-0 overflow-hidden",
            previewOpen
              ? "px-0 sm:px-8 w-full flex-1 min-h-0 sm:overflow-hidden"
              : "max-w-7xl mx-auto px-3 sm:px-8",
            !singlePanel && isEmailApply && "lg:flex-1 lg:min-h-0 lg:overflow-hidden"
          )}
        >
          {previewOpen ? (
            <ApplicationPreviewPanel
              className="mt-0 sm:mt-2 flex-1 min-h-0"
              onClose={() => setPreviewOpen(false)}
              to={to}
              subject={subject}
              body={body}
              letter={letter}
              tailoredCv={tailoredCv}
              onTailoredCvChange={onTailoredCvChange}
              isTailoringCv={isTailoringCv}
              onTailorCv={onTailorCv}
              includeCv={includeCv}
              cvUrl={cvPreview?.url ?? null}
              cvFileName={cvPreview?.fileName ?? null}
              cvLoading={cvLoading}
              coverLetterDocUrl={docUrl}
              sent={app?.status === "sent"}
              canSendAutomatically={canSendAutomatically}
              applicationUrl={job.application_url}
              onSend={onSend}
              onSave={onSave}
              onSaveToDrive={onSaveToDrive}
              sendPending={sendPending}
              savePending={savePending}
              saveToDrivePending={saveToDrivePending}
              packSavedToDrive={packSavedToDrive}
              driveFolderUrl={savedFolderUrl}
            />
          ) : isEmailApply ? (
            <div
              className={cn(
                "flex flex-col",
                !singlePanel && "lg:flex-1 lg:min-h-0 lg:overflow-hidden"
              )}
            >
              <div className="shrink-0 flex items-center justify-between gap-3 py-3 border-b border-border/50">
                <div className="hidden sm:block">
                  <h2 className="text-base font-bold tracking-tight text-foreground">Drafts</h2>
                </div>
                {emailDraftReady && !applyPending && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs px-2.5"
                      onClick={() => setPreviewOpen(true)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5" />
                      Preview & CV
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs px-2.5 hidden sm:inline-flex"
                      onClick={onApply}
                      disabled={applyPending || applyDisabled}
                    >
                      {applyPending ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                      )}
                      Regenerate
                    </Button>
                  </div>
                )}
              </div>

              {siteEmailHint && !applyPending && (
                <p className="shrink-0 text-xs text-muted-foreground py-2 border-b border-border/50">
                  {siteEmailHint}
                </p>
              )}

              {applyPending ? (
                <TypewriterLoader
                  label={job.title ? `Composing application for "${job.title}"...` : "Composing application..."}
                  sublabel="Analyzing the job requirements and your professional history to write a highly tailored cover letter and email draft."
                />
              ) : !emailDraftReady ? (
                <div className="py-10 space-y-4">
                  <p className="text-sm text-muted-foreground max-w-lg">
                    Draft a tailored cover letter and email for this role. You can edit everything
                    before sending from Gmail.
                  </p>
                  {!listingEmail && job.source_url && (
                    <p className="text-sm text-muted-foreground">
                      <a
                        href={job.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground underline underline-offset-2"
                      >
                        Open the job listing
                      </a>{" "}
                      to copy the apply-to address if we do not detect it automatically.
                    </p>
                  )}
                  {limitMessage && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium pb-2">
                      {limitMessage.includes("refer friends") ? (
                        <>
                          Daily pack generation limit reached. Try again tomorrow or{" "}
                          <Link
                            to="/settings"
                            search={{ tab: "referral" } as any}
                            className="underline hover:text-rose-500 font-bold transition-colors"
                          >
                            refer friends
                          </Link>{" "}
                          to unlock upgraded limits!
                        </>
                      ) : (
                        limitMessage
                      )}
                    </p>
                  )}
                  <Button onClick={onApply} disabled={applyPending || applyDisabled}>
                    <Mail className="w-4 h-4 mr-2" />
                    Compose application
                  </Button>
                </div>
              ) : (
                <div
                  className={cn(
                    "relative flex flex-col",
                    !singlePanel && "lg:flex-1 lg:min-h-0 lg:overflow-hidden"
                  )}
                >
                  {applyActionBusy && (
                    <ApplyActionLoader
                      label={saveToDrivePending ? "Saving to Google Drive…" : "Sending email…"}
                    />
                  )}
                  {emailDraftReady && !canSendAutomatically && (
                    <ManualApplyNotice driveFolderUrl={savedFolderUrl} />
                  )}

                      {emailDraftReady && onApplyViewChange && (
                        <div className="shrink-0 flex items-center justify-center py-2.5 border-b border-border/50 w-full hidden lg:flex">
                          <div className="bg-slate-100 dark:bg-muted/40 p-1 rounded-xl flex gap-1 w-full max-w-[340px]">
                            <button
                              type="button"
                              className={cn(
                                "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 select-none cursor-pointer flex items-center justify-center gap-1",
                                applyView === "both" && isLargeScreen
                                  ? "bg-background text-foreground shadow-sm shadow-slate-200/50 dark:shadow-none"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                              onClick={() => setView("both")}
                              style={{ display: isLargeScreen ? "flex" : "none" }}
                            >
                              <Columns2 className="w-3.5 h-3.5" />
                              Both
                            </button>
                            <button
                              type="button"
                              className={cn(
                                "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 select-none cursor-pointer flex items-center justify-center",
                                applyView === "email" || (!isLargeScreen && applyView === "both" && mobileTab === "email")
                                  ? "bg-background text-foreground shadow-sm shadow-slate-200/50 dark:shadow-none"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                              onClick={() => {
                                if (!isLargeScreen && applyView === "both") {
                                  setMobileTab("email");
                                } else {
                                  setView(applyView === "email" ? "both" : "email");
                                }
                              }}
                            >
                              Email
                            </button>
                            <button
                              type="button"
                              className={cn(
                                "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 select-none cursor-pointer flex items-center justify-center",
                                applyView === "letter" || (!isLargeScreen && applyView === "both" && mobileTab === "letter")
                                  ? "bg-background text-foreground shadow-sm shadow-slate-200/50 dark:shadow-none"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                              onClick={() => {
                                if (!isLargeScreen && applyView === "both") {
                                  setMobileTab("letter");
                                } else {
                                  setView(applyView === "letter" ? "both" : "letter");
                                }
                              }}
                            >
                              Cover letter
                            </button>
                          </div>
                        </div>
                      )}

                      <div
                        className={cn(
                          "pt-2 pb-4",
                          singlePanel
                            ? "flex flex-col gap-4 w-full max-w-2xl mx-auto"
                            : "grid grid-cols-1 lg:grid-cols-2 lg:gap-12 lg:items-stretch lg:flex-1 lg:min-h-0 lg:overflow-hidden",
                        )}
                      >
                        {!isLargeScreen ? (
                          <div className="w-full flex flex-col gap-4 min-w-0">
                            {/* Email Accordion Card */}
                            <div className="overflow-hidden">
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setMobileExpanded(mobileExpanded === "email" ? null : "email")}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setMobileExpanded(mobileExpanded === "email" ? null : "email");
                                  }
                                }}
                                className="w-full py-3 flex items-center justify-between hover:opacity-80 transition-colors cursor-pointer select-none outline-none"
                              >
                                <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <span>Email</span>
                                  {app?.status === "sent" ? (
                                    <Badge variant="secondary" className="gap-1 font-normal text-[10px] px-2 py-0.5 shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Sent
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="font-normal text-[10px] px-2 py-0.5 shrink-0">
                                      Draft
                                    </Badge>
                                  )}
                                </span>
                                <Button
                                  type="button"
                                  variant={mobileExpanded === "email" ? "secondary" : "default"}
                                  size="sm"
                                  className="h-7 text-xs pointer-events-none select-none"
                                >
                                  {mobileExpanded === "email" ? "Collapse" : "View"}
                                </Button>
                              </div>

                              {mobileExpanded === "email" && (
                                <div className="pt-3 space-y-4">
                                  <div className={cn(
                                    "space-y-1 min-w-0 transition-all duration-300 ease-in-out origin-top",
                                    headersCollapsed
                                      ? "max-h-0 opacity-0 overflow-hidden pb-0 pt-0 pointer-events-none"
                                      : "max-h-[500px] opacity-100 pb-3"
                                  )}>
                                    <div className="grid grid-cols-[48px_1fr] sm:grid-cols-[60px_1fr] gap-2 sm:gap-3 items-center py-1 border-b border-border/30 min-w-0">
                                      <Label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">To</Label>
                                      <input
                                        type="email"
                                        placeholder="recruiter@company.co.ke"
                                        value={to === "null" ? "" : to}
                                        onChange={(e) => onToChange(e.target.value)}
                                        className="bg-transparent border-none outline-none p-0 h-8 text-[13px] sm:text-[14px] text-foreground placeholder:text-muted-foreground/50 w-full min-w-0 focus:ring-0 focus:outline-none"
                                      />
                                    </div>
                                    {!listingEmail && !normalizeApplyEmail(to) && (
                                      <p className="text-[10px] text-muted-foreground pl-[56px] sm:pl-16 mt-1">
                                        Paste the apply-to address from the job listing.
                                      </p>
                                    )}
                                    <div className="grid grid-cols-[48px_1fr] sm:grid-cols-[60px_1fr] gap-2 sm:gap-3 items-center py-1 border-b border-border/30 min-w-0">
                                      <Label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Cc</Label>
                                      <input
                                        type="text"
                                        placeholder="Optional"
                                        value={cc}
                                        onChange={(e) => onCcChange(e.target.value)}
                                        className="bg-transparent border-none outline-none p-0 h-8 text-[13px] sm:text-[14px] text-foreground placeholder:text-muted-foreground/50 w-full min-w-0 focus:ring-0 focus:outline-none"
                                      />
                                    </div>
                                    <div className="flex flex-col sm:grid sm:grid-cols-[60px_1fr] gap-1 sm:gap-3 py-1.5 sm:py-1 border-b border-border/30 min-w-0">
                                      <Label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1 shrink-0">Subject</Label>
                                      <SubjectTextArea
                                        value={subject}
                                        onChange={onSubjectChange}
                                      />
                                    </div>
                                  </div>
                                  <div className="flex flex-col">
                                    <div className="flex items-center justify-between pl-1 pr-1 mb-2">
                                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Message</Label>
                                      {body && (
                                        <div className="flex items-center gap-2.5">
                                          <CopyAction label="Email" text={`Subject: ${subject}\n\n${body}`} />
                                          <span className="w-px h-3 bg-border/60" />
                                          <ExportButton
                                            title={`Email - ${app?.cv_filename ? app.cv_filename.replace(/\.[^/.]+$/, "") : "Application"}`}
                                            htmlContent={() => formatEmailHtml(subject, body)}
                                            rawText={body}
                                            subject={subject}
                                            docType="email"
                                            disabled={!body}
                                          />
                                        </div>
                                      )}
                                    </div>
                                    <div className="max-h-[45vh] overflow-y-auto">
                                      <ApplyComposeField value={body} onChange={onBodyChange} minHeightPx={180} />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Cover Letter Accordion Card */}
                            <div className="overflow-hidden">
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setMobileExpanded(mobileExpanded === "letter" ? null : "letter")}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setMobileExpanded(mobileExpanded === "letter" ? null : "letter");
                                  }
                                }}
                                className="w-full py-3 flex items-center justify-between hover:opacity-80 transition-colors cursor-pointer select-none outline-none"
                              >
                                <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                                  <FileCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <span>Cover letter</span>
                                  {docUrl && (
                                    <span className="text-[10px] text-muted-foreground font-normal ml-2 bg-muted px-1.5 py-0.5 rounded shrink-0">
                                      Google Docs
                                    </span>
                                  )}
                                  {app?.status === "sent" ? (
                                    <Badge variant="secondary" className="gap-1 font-normal text-[10px] px-2 py-0.5 shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Sent
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="font-normal text-[10px] px-2 py-0.5 shrink-0">
                                      Draft
                                    </Badge>
                                  )}
                                </span>
                                <Button
                                  type="button"
                                  variant={mobileExpanded === "letter" ? "secondary" : "default"}
                                  size="sm"
                                  className="h-7 text-xs pointer-events-none select-none"
                                >
                                  {mobileExpanded === "letter" ? "Collapse" : "View"}
                                </Button>
                              </div>

                              {mobileExpanded === "letter" && (
                                <div className="pt-3 space-y-3">
                                  <div className="flex items-center justify-between pl-1 pr-1 mb-1">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Draft</span>
                                    <div className="flex items-center gap-2.5">
                                      {letter && (
                                        <>
                                          <CopyAction label="Cover letter" text={letter} />
                                          <span className="w-px h-3 bg-border/60" />
                                          <ExportButton
                                            title={`Cover Letter - ${app?.cv_filename ? app.cv_filename.replace(/\.[^/.]+$/, "") : "Application"}`}
                                            htmlContent={() => formatCoverLetterHtml(letter)}
                                            rawText={letter}
                                            docType="letter"
                                            disabled={!letter}
                                          />
                                        </>
                                      )}
                                      {docUrl && (
                                        <>
                                          {letter && <span className="w-px h-3 bg-border/60" />}
                                          <a
                                            href={docUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" /> Open Docs
                                          </a>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="max-h-[45vh] overflow-y-auto">
                                    <ApplyComposeField
                                      value={letter}
                                      onChange={onLetterChange}
                                      serif
                                      minHeightPx={360}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            {!showEmail && onApplyViewChange && (
                              <button
                                type="button"
                                onClick={() => setView("both")}
                                className="hidden lg:flex fixed left-[4.25rem] top-1/2 -translate-y-1/2 z-10 flex-col items-center gap-1 px-2 py-3 text-xs text-muted-foreground hover:text-foreground bg-muted/80 rounded-r-md border border-l-0 border-border/60"
                              >
                                <ChevronRight className="w-4 h-4" />
                                Email
                              </button>
                            )}

                            {showEmail && (
                              <section
                                className={cn(
                                  "flex flex-col min-w-0 w-full",
                                  singlePanel
                                    ? "max-w-2xl w-full"
                                    : "lg:h-full lg:overflow-y-auto lg:pr-2",
                                )}
                              >
                                <div className="shrink-0 flex items-center justify-between gap-2 pb-3">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-medium text-foreground">Email</h3>
                                    {app?.status === "sent" ? (
                                      <Badge variant="secondary" className="gap-1 font-normal text-[10px] px-2 py-0.5 shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Sent
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="font-normal text-[10px] px-2 py-0.5 shrink-0">
                                        Draft
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2.5">
                                    {body && (
                                      <>
                                        <CopyAction label="Email" text={`Subject: ${subject}\n\n${body}`} />
                                        <span className="w-px h-3 bg-border/60" />
                                        <ExportButton
                                          title={`Email - ${app?.cv_filename ? app.cv_filename.replace(/\.[^/.]+$/, "") : "Application"}`}
                                          htmlContent={() => formatEmailHtml(subject, body)}
                                          rawText={body}
                                          subject={subject}
                                          docType="email"
                                          disabled={!body}
                                        />
                                        {onApplyViewChange && <span className="w-px h-3 bg-border/60" />}
                                      </>
                                    )}
                                    {applyView === "both" && onApplyViewChange && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs gap-1 text-muted-foreground"
                                        onClick={() => setView("letter")}
                                      >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                        Hide
                                      </Button>
                                    )}
                                    {applyView === "email" && onApplyViewChange && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs gap-1"
                                        onClick={() => setView("both")}
                                      >
                                        <Columns2 className="w-3.5 h-3.5" />
                                        Show both
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                 <div className={cn(
                                   "shrink-0 space-y-1 min-w-0 transition-all duration-300 ease-in-out origin-top",
                                   headersCollapsed
                                     ? "max-h-0 opacity-0 overflow-hidden pb-0 pt-0 pointer-events-none"
                                     : "max-h-[500px] opacity-100 pb-3"
                                 )}>
                                  <div className="grid grid-cols-[48px_1fr] sm:grid-cols-[60px_1fr] gap-2 sm:gap-3 items-center py-1 border-b border-border/30 min-w-0">
                                    <Label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">To</Label>
                                    <input
                                      type="email"
                                      placeholder="recruiter@company.co.ke"
                                      value={to === "null" ? "" : to}
                                      onChange={(e) => onToChange(e.target.value)}
                                      className="bg-transparent border-none outline-none p-0 h-8 text-[13px] sm:text-[14px] text-foreground placeholder:text-muted-foreground/50 w-full min-w-0 focus:ring-0 focus:outline-none"
                                    />
                                  </div>
                                  {!listingEmail && !normalizeApplyEmail(to) && (
                                    <p className="text-[10px] text-muted-foreground pl-[56px] sm:pl-16 mt-1">
                                      Paste the apply-to address from the job listing.
                                    </p>
                                  )}
                                  <div className="grid grid-cols-[48px_1fr] sm:grid-cols-[60px_1fr] gap-2 sm:gap-3 items-center py-1 border-b border-border/30 min-w-0">
                                    <Label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Cc</Label>
                                    <input
                                      type="text"
                                      placeholder="Optional"
                                      value={cc}
                                      onChange={(e) => onCcChange(e.target.value)}
                                      className="bg-transparent border-none outline-none p-0 h-8 text-[13px] sm:text-[14px] text-foreground placeholder:text-muted-foreground/50 w-full min-w-0 focus:ring-0 focus:outline-none"
                                    />
                                  </div>
                                  <div className="flex flex-col sm:grid sm:grid-cols-[60px_1fr] gap-1 sm:gap-3 py-1.5 sm:py-1 border-b border-border/30 min-w-0">
                                    <Label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1 shrink-0">Subject</Label>
                                    <SubjectTextArea
                                      value={subject}
                                      onChange={onSubjectChange}
                                    />
                                  </div>
                                </div>
                                <div className="flex flex-col lg:shrink-0 mt-3">
                                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 pl-1">Message</Label>
                                  <div className="max-h-[40vh] sm:max-h-none overflow-y-auto sm:overflow-visible rounded-md">
                                    <ApplyComposeField value={body} onChange={onBodyChange} minHeightPx={180} />
                                  </div>
                                </div>
                              </section>
                            )}

                            {!showLetter && onApplyViewChange && (
                              <button
                                type="button"
                                onClick={() => setView("both")}
                                className="hidden lg:flex fixed right-4 top-1/2 -translate-y-1/2 z-10 flex-col items-center gap-1 px-2 py-3 text-xs text-muted-foreground hover:text-foreground bg-muted/80 rounded-l-md border border-r-0 border-border/60"
                              >
                                <ChevronLeft className="w-4 h-4" />
                                Cover letter
                              </button>
                            )}

                            {showLetter && (
                              <section
                                className={cn(
                                  "flex flex-col min-w-0 w-full",
                                  singlePanel
                                    ? "max-w-2xl w-full"
                                    : "lg:h-full lg:overflow-y-auto lg:pr-2",
                                )}
                              >
                                <div className="shrink-0 flex items-center justify-between gap-2 pb-3">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-medium text-foreground">Cover letter</h3>
                                    {app?.status === "sent" ? (
                                      <Badge variant="secondary" className="gap-1 font-normal text-[10px] px-2 py-0.5 shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Sent
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="font-normal text-[10px] px-2 py-0.5 shrink-0">
                                        Draft
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2.5">
                                    {letter && (
                                      <>
                                        <CopyAction label="Cover letter" text={letter} />
                                        <span className="w-px h-3 bg-border/60" />
                                        <ExportButton
                                          title={`Cover Letter - ${app?.cv_filename ? app.cv_filename.replace(/\.[^/.]+$/, "") : "Application"}`}
                                          htmlContent={() => formatCoverLetterHtml(letter)}
                                          rawText={letter}
                                          docType="letter"
                                          disabled={!letter}
                                        />
                                        <span className="w-px h-3 bg-border/60" />
                                      </>
                                    )}
                                    {docUrl && (
                                      <a
                                        href={docUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                                      >
                                        Google Docs
                                      </a>
                                    )}
                                    {docUrl && onApplyViewChange && <span className="w-px h-3 bg-border/60" />}
                                    {applyView === "both" && onApplyViewChange && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs gap-1 text-muted-foreground"
                                        onClick={() => setView("email")}
                                      >
                                        Hide
                                        <ChevronRight className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                    {applyView === "letter" && onApplyViewChange && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs gap-1"
                                        onClick={() => setView("both")}
                                      >
                                        <Columns2 className="w-3.5 h-3.5" />
                                        Show both
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <div className="max-h-[40vh] sm:max-h-none overflow-y-auto sm:overflow-visible rounded-md">
                                  <ApplyComposeField
                                    value={letter}
                                    onChange={onLetterChange}
                                    serif
                                    minHeightPx={360}
                                    className="lg:shrink-0"
                                  />
                                </div>
                              </section>
                            )}
                          </>
                        )}
                      </div>

                      <div
                        className={cn(
                          "shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 py-3 sm:py-4 border-t border-border/50 bg-inherit min-w-0",
                          singlePanel && "max-w-2xl mx-auto w-full",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap min-w-0">
                          <div className="flex items-center gap-2">
                            {canSendAutomatically ? (
                              <>
                                <Checkbox
                                  id="cv"
                                  checked={includeCv}
                                  onCheckedChange={(v) => {
                                    const checked = !!v;
                                    onIncludeCvChange(checked);
                                    if (!checked) {
                                      toast("CV will not be attached", {
                                        description: "Your application will be sent without your CV.",
                                      });
                                    }
                                  }}
                                />
                                <Label htmlFor="cv" className="text-sm font-normal cursor-pointer">
                                  Attach CV when sending
                                </Label>
                              </>
                            ) : packSavedToDrive ? (
                              <p className="text-xs text-muted-foreground">
                                Pack saved to Google Drive
                                {app?.drive_pack_saved_at
                                  ? ` · ${new Date(app.drive_pack_saved_at).toLocaleString()}`
                                  : ""}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Your CV is included when you save the pack to Google Drive.
                              </p>
                            )}
                          </div>

                          <div className="h-5 flex items-center shrink-0">
                            {isSavingDraft ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                Saving…
                              </span>
                            ) : hasUnsavedChanges ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Unsaved changes
                              </span>
                            ) : app?.id ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-500 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                Draft saved
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex w-full sm:w-auto gap-1.5 sm:gap-2 items-center flex-wrap sm:flex-nowrap">
                          {app?.id && (
                            <Button
                              variant="outline"
                              className="flex-1 sm:flex-initial justify-center text-xs sm:text-sm px-2.5 sm:px-4"
                              onClick={() => onApplyPreviewOpenChange?.(true)}
                              disabled={applyActionBusy}
                            >
                              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 shrink-0" />
                              <span className="truncate">Preview & CV</span>
                            </Button>
                          )}
                          {onSaveToDrive && (
                            packSavedToDrive && savedFolderUrl ? (
                              <Button
                                variant="outline"
                                className="flex-1 sm:flex-initial justify-center text-xs sm:text-sm px-2.5 sm:px-4"
                                asChild
                              >
                                <a href={savedFolderUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center">
                                  <FolderOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 shrink-0" />
                                  <span className="truncate">Open Drive folder</span>
                                </a>
                              </Button>
                            ) : (
                              <Button
                                variant={canSendAutomatically ? "outline" : "default"}
                                className="flex-1 sm:flex-initial justify-center text-xs sm:text-sm px-2.5 sm:px-4"
                                onClick={onSaveToDrive}
                                disabled={
                                  packSavedToDrive ||
                                  applyActionBusy ||
                                  !app?.id ||
                                  !subject.trim() ||
                                  !body.trim() ||
                                  !letter.trim()
                                }
                              >
                                {saveToDrivePending ? (
                                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin shrink-0" />
                                ) : (
                                  <FolderOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 shrink-0" />
                                )}
                                <span className="truncate">Save pack to Drive</span>
                              </Button>
                            )
                          )}
                          {canSendAutomatically && (
                            <Button
                              className="flex-1 sm:flex-initial justify-center text-xs sm:text-sm px-2.5 sm:px-4"
                              onClick={onSend}
                              disabled={
                                applyActionBusy ||
                                app?.status === "sent" ||
                                !subject.trim() ||
                                !body.trim()
                              }
                            >
                              {sendPending ? (
                                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin shrink-0" />
                              ) : (
                                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 shrink-0" />
                              )}
                              <span className="truncate">{sendPending ? "Sending..." : "Send via Gmail"}</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
          ) : (
            <div className="space-y-6">
              <div className="pb-4 border-b">
                <h2 className="text-lg font-semibold tracking-tight">Form application</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {job.title}
                  {job.company ? ` · ${job.company}` : ""}
                </p>
              </div>
              {packPending ? (
                <TypewriterLoader
                  label={job.title ? `Drafting form responses for "${job.title}"...` : "Drafting form responses..."}
                  sublabel="Analyzing common application questions for this portal and crafting tailored response drafts grounded in your experience."
                />
              ) : (
                <>
                  {siteFormHint && <p className="text-sm text-muted-foreground">{siteFormHint}</p>}
                  {limitMessage && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium pb-2 w-full">
                      {limitMessage.includes("refer friends") ? (
                        <>
                          Daily pack generation limit reached. Try again tomorrow or{" "}
                          <Link
                            to="/settings"
                            search={{ tab: "referral" } as any}
                            className="underline hover:text-rose-500 font-bold transition-colors"
                          >
                            refer friends
                          </Link>{" "}
                          to unlock upgraded limits!
                        </>
                      ) : (
                        limitMessage
                      )}
                    </p>
                  )}
                  <div className="flex flex-row items-center gap-2 w-full flex-nowrap overflow-x-auto scrollbar-none pb-1">
                    <Button
                      onClick={onPack}
                      disabled={packPending || packDisabled}
                      className="flex-1 md:flex-initial h-11 rounded-xl bg-[#FD5D28] text-white hover:bg-[#e44e1b] font-semibold flex items-center justify-center text-[11px] sm:text-sm px-1.5 sm:px-4 shrink-0"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1 shrink-0" />
                      <span className="truncate">{app?.pack_questions ? "Regenerate" : "Draft responses"}</span>
                    </Button>
                    {onToggleApplicationMethod && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          onToggleApplicationMethod?.();
                        }}
                        className="flex-1 md:flex-initial h-11 rounded-xl border border-slate-200 dark:border-border bg-background hover:bg-slate-50 dark:hover:bg-muted/10 text-slate-800 dark:text-slate-100 font-semibold flex items-center justify-center text-[11px] sm:text-sm px-1.5 sm:px-4 shrink-0"
                      >
                        <Mail className="w-3.5 h-3.5 mr-1 shrink-0" />
                        <span className="truncate">Switch to email</span>
                      </Button>
                    )}
                    {app?.id && (
                      <Button
                        variant="outline"
                        onClick={() => onApplyPreviewOpenChange?.(true)}
                        className="flex-1 md:flex-initial h-11 rounded-xl border border-slate-200 dark:border-border bg-background hover:bg-slate-50 dark:hover:bg-muted/10 text-slate-800 dark:text-slate-100 font-semibold flex items-center justify-center text-[11px] sm:text-sm px-1.5 sm:px-4 shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1 shrink-0" />
                        <span className="truncate">Preview & CV</span>
                      </Button>
                    )}
                    {job.source_url && (
                      <a href={job.source_url} target="_blank" rel="noreferrer" className="hidden md:block flex-1 md:flex-initial shrink-0">
                        <Button
                          variant="outline"
                          className="w-full h-11 rounded-xl border border-slate-200 dark:border-border bg-background hover:bg-slate-50 dark:hover:bg-muted/10 text-slate-800 dark:text-slate-100 font-semibold flex items-center justify-center text-[11px] sm:text-sm px-1.5 sm:px-4"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1 shrink-0" />
                          <span className="truncate">Open form</span>
                        </Button>
                      </a>
                    )}
                  </div>
                  {(app?.cover_letter || app?.email_body) &&
                    !hasApplicationRecipientEmail(job.application_email, app?.application_email) && (
                      <ManualApplyNotice className="mt-2" />
                    )}
                  {(app?.cover_letter || app?.email_body) && onSaveToDrive && (
                    <div className="w-full md:w-auto">
                      {packSavedToDrive && savedFolderUrl ? (
                        <Button
                          variant="outline"
                          className="w-full md:w-auto h-11 rounded-xl border border-slate-200 dark:border-border bg-background hover:bg-slate-50 dark:hover:bg-muted/10 text-slate-800 dark:text-slate-100 font-semibold flex items-center justify-center"
                          asChild
                        >
                          <a href={savedFolderUrl} target="_blank" rel="noreferrer">
                            <FolderOpen className="w-4 h-4 mr-2 shrink-0 text-slate-500" />
                            <span>Open Google Drive folder</span>
                          </a>
                        </Button>
                      ) : (
                        <Button
                          className="w-full md:w-auto h-11 rounded-xl font-semibold flex items-center justify-center"
                          onClick={onSaveToDrive}
                          disabled={packSavedToDrive || saveToDrivePending || !app?.id}
                        >
                          {saveToDrivePending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" />
                          ) : (
                            <FolderOpen className="w-4 h-4 mr-2 shrink-0" />
                          )}
                          <span>Save pack to Google Drive</span>
                        </Button>
                      )}
                    </div>
                  )}
                  {app?.pack_questions && parsePackQuestions(app.pack_questions).length > 0 ? (
                    <div className="space-y-4 pt-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Form responses</h3>
                      <div className="divide-y">
                        {parsePackQuestions(app.pack_questions).map((qa, i) => (
                          <div key={i} className="py-4 text-sm first:pt-0">
                            <div className="font-medium text-foreground">{qa.question}</div>
                            <div className="mt-2 text-foreground/80 whitespace-pre-wrap">{qa.answer}</div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(qa.answer);
                                toast.success("Copied");
                              }}
                              className="text-xs text-primary mt-2 inline-flex gap-1"
                            >
                              <Copy className="w-3.5 h-3.5" /> Copy
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : app?.cover_letter ? (
                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border">
                        No custom form questions were extracted for this portal. You can copy the cover letter and email drafts below.
                      </p>
                    </div>
                  ) : null}

                  {(app?.cover_letter || letter?.trim()) && (
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-muted-foreground">Cover Letter</h3>
                          {docUrl && (
                            <a
                              href={docUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
                            >
                              <ExternalLink className="w-3 h-3" /> Open in Google Docs
                            </a>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => {
                            navigator.clipboard.writeText((letter || app?.cover_letter || "") as string);
                            toast.success("Cover letter copied");
                          }}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" /> Copy Cover Letter
                        </Button>
                      </div>
                      <div className="p-4 bg-muted/30 dark:bg-muted/10 rounded-xl border border-border/50 text-sm whitespace-pre-wrap text-foreground/80 max-h-[300px] overflow-y-auto">
                        {letter || app?.cover_letter}
                      </div>
                    </div>
                  )}

                  {(app?.email_body || body?.trim()) && (
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-muted-foreground">Email Draft</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => {
                            navigator.clipboard.writeText((body || app?.email_body || "") as string);
                            toast.success("Email body copied");
                          }}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" /> Copy Email Body
                        </Button>
                      </div>
                      {(subject || app?.email_subject) && (
                        <div className="text-sm text-foreground/90 font-medium flex flex-col sm:flex-row gap-0.5 sm:gap-1.5">
                          <span className="text-muted-foreground shrink-0">Subject:</span>
                          <span className="break-words">{subject || app?.email_subject}</span>
                        </div>
                      )}
                      <div className="p-4 bg-muted/30 dark:bg-muted/10 rounded-xl border border-border/50 text-sm whitespace-pre-wrap text-foreground/80 max-h-[250px] overflow-y-auto">
                        {body || app?.email_body}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overscroll-contain py-4 sm:py-6",
          activeApplySection !== "interview" && "hidden",
        )}
      >
        <div className="max-w-7xl mx-auto w-full px-3 sm:px-8 min-w-0">
          <div id="job-interview-section" className="pb-6 sm:pb-10 scroll-mt-4 min-w-0">
            <div className="mb-4 sm:mb-6">
              <h2 className="text-base sm:text-lg font-semibold tracking-tight">Interview prep</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Practice questions and mock interviews for {job.title}
                {job.company ? ` at ${job.company}` : ""}.
              </p>
            </div>

            <div className="flex flex-row gap-3 mb-6">
              <Button
                type="button"
                className="flex-1 sm:flex-initial h-11 sm:h-10 text-xs sm:text-sm font-semibold"
                onClick={() => onInterviewSheetOpenChange?.(!interviewSheetOpen)}
                disabled={!hasPrepQuestions}
              >
                <ClipboardList className="w-4 h-4 mr-2 shrink-0" />
                {interviewSheetOpen ? "Interview in progress" : "Start mock interview"}
              </Button>

              {onInterviewGenerate && (
                <Button
                  onClick={onInterviewGenerate}
                  disabled={interviewPending || interviewDisabled}
                  className="flex-1 sm:flex-initial h-11 sm:h-10 text-xs sm:text-sm font-semibold"
                >
                  <ClipboardList className="w-4 h-4 mr-2 shrink-0" />
                  {prepQuestionsCount > 0 ? "Regenerate prep" : "Draft prep"}
                </Button>
              )}
            </div>

            {limitMessage && !hasPrepQuestions && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium -mt-3 mb-6">
                {limitMessage.includes("refer friends") ? (
                  <>
                    Daily pack generation limit reached. Try again tomorrow or{" "}
                    <Link
                      to="/settings"
                      search={{ tab: "referral" } as any}
                      className="underline hover:text-rose-500 font-bold transition-colors"
                    >
                      refer friends
                    </Link>{" "}
                    to unlock upgraded limits!
                  </>
                ) : (
                  limitMessage
                )}
              </p>
            )}

            {!hasPrepQuestions && (
              <p className="text-xs text-muted-foreground -mt-3 mb-6">
                Draft practice questions first — the interview uses those topics.
              </p>
            )}

            <div className="flex flex-col gap-5 sm:gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_min(20rem,22rem)] xl:grid-cols-[minmax(0,1fr)_min(24rem,26rem)] lg:gap-10 lg:items-start">
              <aside className="min-w-0 w-full space-y-4 lg:order-2 lg:sticky lg:top-4">
                <InterviewModeLauncher
                  jobId={job.id}
                  jobTitle={job.title}
                  company={job.company}
                  placement="aside"
                  hasPrepQuestions={hasPrepQuestions}
                  sheetOpenFromUrl={interviewSheetOpen}
                  onSheetOpenChange={onInterviewSheetOpenChange}
                  onReportGenerated={onInterviewReportRefresh}
                  hideLauncher={true}
                />
                <InterviewReportSection reportRaw={app?.interview_report} embedded />
              </aside>

              <div className="min-w-0 w-full lg:order-1">
                {onInterviewGenerate && (
                  <InterviewQuestionsSection
                    interviewQuestionsRaw={app?.interview_questions}
                    onGenerate={onInterviewGenerate}
                    generatePending={interviewPending}
                    hideButton={true}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Matching Analysis Section ── */}
      <div
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overscroll-contain py-6",
          activeApplySection !== "matching" && "hidden",
        )}
      >
        <div className="max-w-7xl mx-auto w-full px-3 sm:px-8">
          <div id="job-matching-section" className="pb-6 sm:pb-10 scroll-mt-4">
            <div className="mb-6">
              <h2 className="text-base sm:text-lg font-semibold tracking-tight">Matching analysis</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                How your profile aligns with {job.title}
                {job.company ? ` at ${job.company}` : ""}.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Score overview */}
              <div className="space-y-5 py-4">
                <div className="flex items-start gap-4">
                  <MatchRing score={score} size={64} />
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                      AI Evaluation
                    </div>
                    <h3 className="font-bold text-lg text-foreground tracking-tight">How you match</h3>
                  </div>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">{matchReason || "Generate your application to see how your profile matches this role."}</p>

                {/* Keyword match */}
                {keywords.total > 0 && (
                  <div className="pt-4 border-t border-border/40 flex items-center gap-4">
                    <MatchRing score={Math.round((keywords.found / keywords.total) * 100)} size={48} />
                    <div className="space-y-0.5">
                      <div className="font-bold text-sm text-foreground tracking-tight">Keyword match</div>
                      <div className="text-xs text-muted-foreground">
                        {keywords.found} of {keywords.total} of your skills found
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Strengths & Gaps */}
              <div className="space-y-6">
                {strengths.length > 0 && (
                  <div className="space-y-3 py-4">
                    <div className="text-xs font-bold tracking-widest uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      Your strengths
                    </div>
                    <ul className="space-y-2">
                      {strengths.map((s, i) => (
                        <li key={i} className="text-sm flex gap-2 text-foreground/80 leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {gaps.length > 0 && (
                  <div className="space-y-3 py-4">
                    <div className="text-xs font-bold tracking-widest uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      Gaps to address
                    </div>
                    <ul className="space-y-2">
                      {gaps.map((g, i) => (
                        <li key={i} className="text-sm flex gap-2 text-foreground/80 leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 shrink-0" />
                          <span>{g}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Skill tags */}
            {skillTags.length > 0 && (
              <div className="mt-8 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Skills mentioned in this listing
                </h3>
                <div className="flex flex-wrap gap-2">
                  {skillTags.map((s) => (
                    <Badge key={s} variant="secondary" className="font-normal">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Job Qualifications Section ── */}
      <div
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overscroll-contain py-6",
          activeApplySection !== "qualifications" && "hidden",
        )}
      >
        <div className="max-w-7xl mx-auto w-full px-3 sm:px-8">
          <div id="job-qualifications-section" className="pb-6 sm:pb-10 scroll-mt-4">
            <div className="mb-6">
              <h2 className="text-base sm:text-lg font-semibold tracking-tight">Job qualifications</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Requirements and responsibilities for {job.title}
                {job.company ? ` at ${job.company}` : ""}.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Requirements */}
              {requirements.length > 0 && (
                <div className="space-y-4 py-4">
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    <FileCheck className="w-4.5 h-4.5 text-primary shrink-0" />
                    Requirements
                  </h3>
                  <ul className="space-y-2.5">
                    {requirements.map((r, i) => (
                      <li key={i} className="text-sm flex gap-2 text-foreground/90 leading-relaxed">
                        <span className="text-primary mt-1 shrink-0">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Responsibilities */}
              {responsibilities.length > 0 && (
                <div className="space-y-4 py-4">
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    <ClipboardList className="w-4.5 h-4.5 text-primary shrink-0" />
                    Responsibilities
                  </h3>
                  <ul className="space-y-2.5">
                    {responsibilities.map((r, i) => (
                      <li key={i} className="text-sm flex gap-2 text-foreground/90 leading-relaxed">
                        <span className="text-primary mt-1 shrink-0">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {requirements.length === 0 && responsibilities.length === 0 && (
                <div className="col-span-full py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Qualification details will appear here once the job has been analyzed.
                  </p>
                </div>
              )}
            </div>

            {/* Salary + Meta info */}
            {(job.salary_text || job.salary_min || job.salary_max || job.job_type || job.location) && (
              <div className="mt-8 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                  Position details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(job.salary_text || job.salary_min || job.salary_max) && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Salary</span>
                      <p className="text-sm font-semibold text-foreground">
                        {job.salary_text ||
                          [job.salary_min && `KSh ${job.salary_min.toLocaleString()}`, job.salary_max && `– ${job.salary_max.toLocaleString()}`]
                            .filter(Boolean)
                            .join(" ")}
                      </p>
                    </div>
                  )}
                  {job.job_type && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Job type</span>
                      <p className="text-sm font-semibold text-foreground">{job.job_type}</p>
                    </div>
                  )}
                  {locationLabel && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Location</span>
                      <p className="text-sm font-semibold text-foreground">{locationLabel}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
