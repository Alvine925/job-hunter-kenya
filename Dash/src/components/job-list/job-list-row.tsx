import { useNavigate } from "@tanstack/react-router";
import { CompanyLogo } from "@/components/job-detail/company-logo";
import { youVoice } from "@/components/job-detail/utils";
import { cn } from "@/lib/utils";
import type { JobApplicationStatus } from "@/lib/job-list-utils";
import { scanApplicationMethod } from "@/lib/scraped-jobs";
import {
  Building2,
  Briefcase,
  ClipboardList,
  ExternalLink,
  Mail,
  MapPin,
} from "lucide-react";

type Job = {
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
  application_email?: string | null;
  application_method?: string | null;
  deadline?: string | null;
  application_status?: JobApplicationStatus | null;
  logo_url?: string | null;
};

function matchStyles(score: number) {
  if (score >= 80) {
    return {
      text: "text-emerald-600",
      ring: "ring-emerald-200",
      bg: "bg-emerald-50",
    };
  }
  if (score >= 60) {
    return {
      text: "text-amber-600",
      ring: "ring-amber-200",
      bg: "bg-amber-50",
    };
  }
  return {
    text: "text-stone-500",
    ring: "ring-stone-200",
    bg: "bg-stone-50",
  };
}

export function JobListRow({ job }: { job: Job }) {
  const navigate = useNavigate();
  const score = job.match_score ?? 0;
  const match = matchStyles(score);
  const location = [job.location, job.county].filter(Boolean).join(", ");
  const isEmail = scanApplicationMethod(job as any) === "email";
  const why = youVoice(job.match_reason);
  const packLabel = job.application_status?.label;

  const openJob = () => navigate({ to: "/jobs/$id", params: { id: job.id } });

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={openJob}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openJob();
        }
      }}
      className="group flex gap-4 sm:gap-5 px-4 sm:px-6 py-5 transition-colors hover:bg-muted/40 cursor-pointer border-b border-border/70 last:border-b-0"
    >
        <CompanyLogo
          company={job.company ?? "Company"}
          source={job.source}
          sourceUrl={job.source_url}
          logoUrl={job.logo_url}
          size="sm"
        />

      <div className="min-w-0 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-foreground leading-snug tracking-tight group-hover:text-primary transition-colors line-clamp-2">
              {job.title}
            </h3>
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              <span
                className={cn(
                  "text-sm font-bold tabular-nums px-2.5 py-1 rounded-full ring-1",
                  match.text,
                  match.bg,
                  match.ring,
                )}
              >
                {score}% match
              </span>
              {job.source_url && (
                <a
                  href={job.source_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-md text-muted-foreground/70 hover:text-primary hover:bg-primary/5 transition-colors"
                  aria-label="Open original listing"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm">
            {job.company && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground font-medium">
                <Building2 className="w-3.5 h-3.5 shrink-0 opacity-70" />
                {job.company}
              </span>
            )}
            {location && (
              <span className="inline-flex items-center gap-1.5 text-sky-700 font-medium">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {location}
              </span>
            )}
            {job.job_type && (
              <span className="text-violet-700 font-semibold">{job.job_type}</span>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md",
                isEmail
                  ? "bg-sky-50 text-sky-800"
                  : "bg-violet-50 text-violet-800",
              )}
            >
              {isEmail ? (
                <Mail className="w-3 h-3" />
              ) : (
                <ClipboardList className="w-3 h-3" />
              )}
              {isEmail ? "Email apply" : "Form apply"}
            </span>
            {packLabel && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md",
                  packLabel === "Applied"
                    ? "bg-emerald-50 text-emerald-800"
                    : packLabel === "Pack ready"
                      ? "bg-primary/10 text-primary"
                      : "bg-amber-50 text-amber-800",
                )}
              >
                <Briefcase className="w-3 h-3" />
                {packLabel}
              </span>
            )}
            {job.source && (
              <span className="text-xs text-muted-foreground/80">via {job.source}</span>
            )}
            {job.deadline && (
              <span className="text-xs text-rose-600 font-medium">
                Deadline {new Date(job.deadline).toLocaleDateString()}
              </span>
            )}
          </div>

          {why && (
            <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2">
              <span className="font-semibold text-foreground/70">Why you match: </span>
              {why}
            </p>
          )}
        </div>
    </article>
  );
}
