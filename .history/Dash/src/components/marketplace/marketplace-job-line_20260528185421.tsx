import { memo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CompanyLogo } from "@/components/job-detail/company-logo";
import { boardLabel, scanApplicationMethod, type ScrapedJob } from "@/lib/scraped-jobs";
import { cn } from "@/lib/utils";
import { ArrowRight, ExternalLink, MapPin, Mail, ClipboardList, Briefcase, Sparkles } from "lucide-react";

export const MarketplaceJobLine = memo(function MarketplaceJobLine({ job }: { job: ScrapedJob }) {
  const navigate = useNavigate();
  const location = [job.location, job.county].filter(Boolean).join(", ");
  const board = boardLabel(job);
  const summary =
    job.description_summary?.trim() ||
    job.role_description?.trim()?.slice(0, 200) ||
    "";

  const appMethod = scanApplicationMethod(job);
  const isEmail = appMethod === "email";

  const openJob = () => {
    if (job.id.startsWith("user_")) {
      void navigate({ to: "/jobs/$id", params: { id: job.id.slice(5) } });
      return;
    }
    void navigate({ to: "/marketplace/$id", params: { id: job.id } });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openJob}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openJob();
        }
      }}
      className={cn(
        "group relative w-full text-left cursor-pointer transition-colors",
        "max-sm:rounded-xl max-sm:border max-sm:border-border/80 max-sm:bg-background max-sm:p-4 max-sm:shadow-sm",
        "sm:flex sm:gap-4 sm:px-5 sm:py-4",
        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
      )}
    >
      <div className="flex gap-3 sm:gap-4 w-full min-w-0">
        <div className="hidden sm:block shrink-0">
          <CompanyLogo
            company={job.company ?? board}
            source={board}
            sourceUrl={job.source_url}
            logoUrl={job.logo_url}
            size="md"
          />
        </div>
        <div className="sm:hidden shrink-0">
          <CompanyLogo
            company={job.company ?? board}
            source={board}
            sourceUrl={job.source_url}
            logoUrl={job.logo_url}
            size="sm"
          />
        </div>

        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                {job.title}
              </h3>
              {job.company && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">{job.company}</p>
              )}
              {location && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1 min-w-0">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{location}</span>
                </p>
              )}
            </div>

            {job.source_url && (
              <a
                href={job.source_url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="relative z-20 shrink-0 p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                aria-label="Open original listing"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>

          {/* Tags */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {job.match_score !== undefined && job.match_score > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 px-2.5 py-1 text-[10px] font-bold">
                <Sparkles className="w-2.5 h-2.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {job.match_score}% Match
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-1 text-[10px] font-semibold text-foreground/80">
              {board}
            </span>
            {job.job_type && (
              <span className="inline-flex items-center rounded-full bg-[#F3E8FF] dark:bg-purple-500/15 px-2.5 py-1 text-[10px] font-semibold text-[#7C3AED] dark:text-purple-300">
                {job.job_type}
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
                isEmail
                  ? "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
              )}
            >
              {isEmail ? (
                <Mail className="w-2.5 h-2.5 shrink-0" />
              ) : (
                <ClipboardList className="w-2.5 h-2.5 shrink-0" />
              )}
              {isEmail ? "Email" : "Form"}
            </span>
            {job.application_status?.label && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
                  job.application_status.label === "Applied"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                    : job.application_status.label === "Pack ready"
                      ? "bg-primary/10 text-primary"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
                )}
              >
                <Briefcase className="w-2.5 h-2.5 shrink-0" />
                {job.application_status.label}
              </span>
            )}
            {(job.deadline_text || job.deadline) && (
              <span className="inline-flex items-center rounded-full bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                {job.deadline_text ||
                  (job.deadline
                    ? new Date(job.deadline).toLocaleDateString()
                    : null)}
              </span>
            )}
          </div>

          {summary && (
            <p className="mt-3 text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {summary}
            </p>
          )}

          {/* Mobile CTA */}
          <div className="mt-4 sm:hidden">
            <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0F172A] dark:bg-white py-2.5 text-sm font-semibold text-white dark:text-[#0F172A]">
              View listing
              <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
