import { Link } from "@tanstack/react-router";
import { CompanyLogo } from "./company-logo";
import { cn } from "@/lib/utils";

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
  logo_url?: string | null;
};

function matchColor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-stone-500";
}

export function SimilarJobsSection({
  jobs,
  currentId,
  linkTo = "jobs",
}: {
  jobs: SimilarJob[];
  currentId: string;
  /** `marketplace` links to /marketplace/$id (scraped_jobs); `jobs` links to /jobs/$id */
  linkTo?: "jobs" | "marketplace";
}) {
  const filtered = jobs.filter((j) => j.id !== currentId).slice(0, 5);
  if (filtered.length === 0) return null;

  return (
    <section className="border-t border-border/80 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-10">
        <h2 className="text-lg font-bold tracking-tight text-foreground">Similar jobs</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          Other roles you may want to explore
        </p>
        <ul className="divide-y divide-border/70 rounded-xl border border-border/80 overflow-hidden">
          {filtered.map((j) => {
            const score = j.match_score ?? 0;
            const place = [j.location, j.county].filter(Boolean).join(", ");
            return (
              <li key={j.id}>
                <Link
                  to={linkTo === "marketplace" ? "/marketplace/$id" : "/jobs/$id"}
                  params={{ id: j.id }}
                  className="flex items-center gap-4 px-4 sm:px-5 py-4 hover:bg-muted/40 transition-colors"
                >
                  <CompanyLogo
                    company={j.company ?? "Company"}
                    source={j.source}
                    sourceUrl={j.source_url}
                    logoUrl={j.logo_url}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground line-clamp-1">{j.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                      {j.company && <span>{j.company}</span>}
                      {place && (
                        <>
                          <span className="text-border">·</span>
                          <span className="text-sky-700">{place}</span>
                        </>
                      )}
                      {j.job_type && (
                        <>
                          <span className="text-border">·</span>
                          <span className="text-violet-700 font-medium">{j.job_type}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums shrink-0",
                      matchColor(score),
                    )}
                  >
                    {score}%
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
