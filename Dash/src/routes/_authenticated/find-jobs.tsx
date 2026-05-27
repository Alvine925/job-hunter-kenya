import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listJobs, scrapeJobsForMe, listSavedJobs } from "@/lib/api";
import { JobListRow } from "@/components/job-list/job-list-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jobHasApplicationPack } from "@/lib/job-list-utils";
import { scanApplicationMethod } from "@/lib/scraped-jobs";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, Search, Sparkles, Bookmark, Mail, ClipboardList } from "lucide-react";
import { TellusLoader } from "@/components/ui/tellus-loader";
import { JobListSkeleton } from "@/components/ui/skeleton-loaders";
import { toast } from "sonner";
import { useMemo, useState } from "react";

type JobsSection = "all" | "pack_ready" | "saved";

export const Route = createFileRoute("/_authenticated/find-jobs")({
  head: () => ({
    title: "Find Jobs - Tellus",
    meta: [
      { title: "Find Jobs - Tellus" },
      { name: "description", content: "Browse and filter jobs tailored to your skills, check compatibility, and request AI assistance." },
    ],
  }),
  component: FindJobs,
});

function FindJobs() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [section, setSection] = useState<JobsSection>("all");
  const [applyMethod, setApplyMethod] = useState<"all" | "email" | "form">("all");

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => listJobs(),
  });

  const { data: savedJobsData, isLoading: isSavedLoading } = useQuery({
    queryKey: ["saved-jobs"],
    queryFn: () => listSavedJobs(),
  });

  const scrapeMut = useMutation({
    mutationFn: () => scrapeJobsForMe({ limit: 20 }),
    onSuccess: (r) => {
      toast.success(`Found ${r?.count ?? 0} new jobs`);
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["saved-jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allJobs = data?.jobs ?? [];
  const savedJobs = savedJobsData?.jobs ?? [];
  const isLoadingAll = isLoading || (section === "saved" && isSavedLoading && !savedJobsData);

  const packReadyCount = useMemo(
    () => allJobs.filter((j) => jobHasApplicationPack(j)).length,
    [allJobs],
  );

  const methodCounts = useMemo(() => {
    let pool;
    if (section === "saved") {
      pool = savedJobs;
    } else if (section === "pack_ready") {
      pool = allJobs.filter((j) => jobHasApplicationPack(j));
    } else {
      pool = allJobs;
    }

    let email = 0;
    let form = 0;
    for (const j of pool) {
      if (scanApplicationMethod(j as any) === "email") {
        email++;
      } else {
        form++;
      }
    }
    return { all: pool.length, email, form };
  }, [allJobs, savedJobs, section]);

  const jobs = useMemo(() => {
    let pool;
    if (section === "saved") {
      pool = savedJobs;
    } else if (section === "pack_ready") {
      pool = allJobs.filter((j) => jobHasApplicationPack(j));
    } else {
      pool = allJobs;
    }

    if (applyMethod === "email") {
      pool = pool.filter((j) => scanApplicationMethod(j as any) === "email");
    } else if (applyMethod === "form") {
      pool = pool.filter((j) => scanApplicationMethod(j as any) === "form");
    }

    const term = filter.trim().toLowerCase();
    if (!term) return pool;
    return pool.filter(
      (j: { title?: string; company?: string }) =>
        j.title?.toLowerCase().includes(term) ||
        j.company?.toLowerCase().includes(term),
    );
  }, [allJobs, savedJobs, filter, section, applyMethod]);

  return (
    <div className="min-h-full bg-muted/30">
      <header className="border-b border-border/80 bg-background/95 backdrop-blur-sm lg:sticky top-0 z-10 p-4 sm:px-8 py-5 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 max-w-5xl">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Find Jobs</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
              {allJobs.length > 0
                ? `${allJobs.length} saved job${allJobs.length === 1 ? "" : "s"} in your account${isFetching ? " — refreshing…" : ""}. Rescrape to find more.`
                : "Jobs matched to your profile. Rescrape to discover new listings."}
            </p>
          </div>
          <Button
            onClick={() => scrapeMut.mutate()}
            disabled={scrapeMut.isPending}
            className="shrink-0"
          >
            {scrapeMut.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Rescrape
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-4 max-w-2xl">
          <button
            type="button"
            onClick={() => setSection("all")}
            className={cn(
              "text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full border transition-colors",
              section === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/40",
            )}
          >
            All jobs ({allJobs.length})
          </button>
          <button
            type="button"
            onClick={() => setSection("pack_ready")}
            className={cn(
              "text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full border transition-colors",
              section === "pack_ready"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/40",
            )}
          >
            Pack ready ({packReadyCount})
          </button>
          <button
            type="button"
            onClick={() => setSection("saved")}
            className={cn(
              "text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full border transition-colors",
              section === "saved"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/40",
            )}
          >
            Saved ({savedJobs.length})
          </button>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4 max-w-5xl">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filter by title or company..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-10 h-9 text-xs sm:text-sm bg-background"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground mr-1">Apply Method:</span>
            <div className="inline-flex rounded-lg border border-border/80 bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => setApplyMethod("all")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-medium transition-all",
                  applyMethod === "all"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                All ({methodCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setApplyMethod("email")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-medium inline-flex items-center gap-1.5 transition-all",
                  applyMethod === "email"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Mail className="w-3.5 h-3.5" />
                Email ({methodCounts.email})
              </button>
              <button
                type="button"
                onClick={() => setApplyMethod("form")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-medium inline-flex items-center gap-1.5 transition-all",
                  applyMethod === "form"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Form ({methodCounts.form})
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-8 py-5 sm:py-6 max-w-5xl">
        {isLoadingAll ? (
          <JobListSkeleton hideHeader />
        ) : isError ? (
          <div className="py-16 text-center text-sm text-destructive">
            {(error as Error)?.message ?? "Could not load your jobs"}
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-20 text-center max-w-md mx-auto border border-border/80 rounded-lg bg-background p-10 animate-in fade-in duration-200">
            {section === "saved" ? (
              <Bookmark className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
            ) : (
              <Sparkles className="w-10 h-10 text-muted-foreground/50 mx-auto mb-4" />
            )}
            <p className="text-muted-foreground text-sm mb-2">
              {section === "saved"
                ? savedJobs.length === 0
                  ? "No saved jobs yet. Open a job and click Save to bookmark it."
                  : "No saved jobs match your filter."
                : section === "pack_ready"
                  ? packReadyCount === 0
                    ? "No packs yet. Open a job, generate your application pack (email, cover letter, CV, interview prep), then it appears here."
                    : "No pack-ready jobs match your filter."
                  : allJobs.length === 0
                    ? "No jobs yet. Click Rescrape to fetch jobs matched to your profile."
                    : "No jobs match your filter."}
            </p>
            {allJobs.length === 0 && section !== "saved" && (
              <p className="text-xs text-muted-foreground">
                Make sure your profile has desired roles and skills filled in.
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              Showing <span className="font-semibold text-foreground">{jobs.length}</span>
              {section === "saved"
                ? " saved jobs"
                : section === "pack_ready"
                  ? " jobs with an application pack"
                  : filter
                    ? " matching jobs"
                    : " matched jobs"}
              {applyMethod === "email" && " (Email Apply)"}
              {applyMethod === "form" && " (Form Apply)"}
            </p>
            <div className="border border-border/80 rounded-lg bg-background overflow-hidden animate-in fade-in duration-200">
              {jobs.map((job: any) => (
                <JobListRow key={job.id} job={job} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
