import { useEffect, useState } from "react";
import { MarketplaceJobLine } from "@/components/marketplace/marketplace-job-line";
import { Button } from "@/components/ui/button";
import type { ScrapedJob } from "@/lib/scraped-jobs";
import { Sparkles } from "lucide-react";

type Props = {
  jobs: ScrapedJob[];
  onClearFilters: () => void;
};

export function MarketplaceJobList({ jobs, onClearFilters }: Props) {
  const [renderLimit, setRenderLimit] = useState(40);

  useEffect(() => {
    setRenderLimit(40);
    const timer = window.setTimeout(() => setRenderLimit(jobs.length), 120);
    return () => window.clearTimeout(timer);
  }, [jobs]);

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-border/80 bg-background py-14 px-6 text-center">
        <Sparkles className="w-9 h-9 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          No jobs match your filters. Try adjusting your search.
        </p>
        <Button variant="link" onClick={onClearFilters} className="mt-2 text-primary">
          Clear all filters
        </Button>
      </div>
    );
  }

  const visibleJobs = jobs.slice(0, renderLimit);

  return (
    <div className="max-sm:space-y-3 sm:border sm:border-border/80 sm:rounded-xl sm:bg-background sm:overflow-hidden sm:divide-y sm:divide-border/60">
      {visibleJobs.map((job) => (
        <MarketplaceJobLine key={job.id} job={job} />
      ))}
    </div>
  );
}
