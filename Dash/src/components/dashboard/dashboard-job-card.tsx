import { Link } from "@tanstack/react-router";
import { CompanyLogo } from "@/components/job-detail/company-logo";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Building2,
  Calendar,
  MapPin,
} from "lucide-react";

type DashboardJob = {
  id: string;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  county?: string | null;
  job_type?: string | null;
  match_score?: number | null;
  match_reason?: string | null;
  source?: string | null;
  source_url?: string | null;
  logo_url?: string | null;
  saved_at?: string | null;
  is_remote?: boolean | null;
  created_at?: string | null;
};

function MatchScoreRing({ score }: { score: number }) {
  const r = 7;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;
  const stroke =
    score >= 80 ? "#10B981" : score >= 60 ? "#D97706" : "#94A3B8";

  return (
    <svg className="w-5 h-5 shrink-0 -rotate-90" viewBox="0 0 20 20" aria-hidden>
      <circle
        cx="10"
        cy="10"
        r={r}
        fill="none"
        className="stroke-slate-200 dark:stroke-muted/40"
        strokeWidth="2.5"
      />
      <circle
        cx="10"
        cy="10"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

function workModeLabel(job: DashboardJob): string | null {
  if (job.is_remote) return "Remote";
  const type = (job.job_type ?? "").toLowerCase();
  if (type.includes("remote")) return "Remote";
  if (type.includes("hybrid")) return "Hybrid";
  const loc = [job.location, job.county].filter(Boolean).join(", ");
  if (loc) return "On-site";
  return null;
}

type Props = {
  job: DashboardJob;
  location: string;
  onToggleSave: () => void;
  isSaving?: boolean;
};

export function DashboardJobCard({ job, location, onToggleSave, isSaving }: Props) {
  const score = job.match_score ?? 0;
  const isHighMatch = score >= 80;
  const workMode = workModeLabel(job);
  const snippet = job.match_reason?.trim();

  return (
    <article className="w-full border-b border-[#E2E8F0] dark:border-border/10 py-5 last:border-b-0">
      {/* Header: logo + job info + bookmark */}
      <div className="flex gap-3">
        <CompanyLogo
          company={job.company ?? "Company"}
          source={job.source}
          sourceUrl={job.source_url}
          logoUrl={job.logo_url}
          size="md"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <Link
                to="/jobs/$id"
                params={{ id: job.id }}
                className="block font-bold text-[15px] sm:text-base text-[#1E293B] dark:text-white leading-snug line-clamp-2 hover:text-[#FD5D28] transition-colors"
              >
                {job.title}
              </Link>
              {job.company && (
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                  {job.company}
                </p>
              )}
              {location && (
                <p className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 min-w-0">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{location}</span>
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleSave();
              }}
              disabled={isSaving}
              className={cn(
                "shrink-0 p-1.5 rounded-lg transition-colors cursor-pointer",
                job.saved_at
                  ? "text-[#FD5D28]"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300",
              )}
              aria-label={job.saved_at ? "Unsave job" : "Save job"}
            >
              {job.saved_at ? (
                <BookmarkCheck className="w-5 h-5" />
              ) : (
                <Bookmark className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Match badge */}
      <div
        className={cn(
          "mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold",
          isHighMatch
            ? "bg-[#E8F8F0] text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-400"
            : "bg-[#FFF5E6] text-[#D97706] dark:bg-amber-500/15 dark:text-amber-400",
        )}
      >
        <MatchScoreRing score={score} />
        <span>{score}% Match</span>
      </div>

      {/* Attribute tags */}
      {(job.job_type || workMode || job.source) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {job.job_type && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3E8FF] dark:bg-purple-500/15 px-2.5 py-1 text-[11px] font-semibold text-[#7C3AED] dark:text-purple-300">
              <Calendar className="w-3 h-3 shrink-0" />
              {job.job_type}
            </span>
          )}
          {workMode && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E0F2FE] dark:bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-[#0284C7] dark:text-sky-300">
              <Building2 className="w-3 h-3 shrink-0" />
              {workMode}
            </span>
          )}
          {!workMode && job.source && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E0F2FE] dark:bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-[#0284C7] dark:text-sky-300">
              <Building2 className="w-3 h-3 shrink-0" />
              {job.source}
            </span>
          )}
        </div>
      )}

      {/* Description snippet */}
      {snippet && (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3">
          {snippet}
        </p>
      )}

      {/* Footer actions */}
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onToggleSave();
          }}
          disabled={isSaving}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] dark:border-border/20",
            "py-2.5 text-sm font-semibold transition-colors cursor-pointer",
            job.saved_at
              ? "text-[#FD5D28] border-[#FD5D28]/30"
              : "text-[#1E293B] dark:text-white hover:bg-slate-50 dark:hover:bg-muted/10",
          )}
        >
          {job.saved_at ? (
            <BookmarkCheck className="w-4 h-4" />
          ) : (
            <Bookmark className="w-4 h-4" />
          )}
          {job.saved_at ? "Saved" : "Save"}
        </button>

        <Link
          to="/jobs/$id"
          params={{ id: job.id }}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F172A] dark:bg-white py-2.5 text-sm font-semibold text-white dark:text-[#0F172A] hover:bg-[#1E293B] dark:hover:bg-slate-100 transition-colors"
        >
          View Job
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}
