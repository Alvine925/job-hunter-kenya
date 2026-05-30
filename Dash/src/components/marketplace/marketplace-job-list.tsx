import { useEffect, useState, useRef } from "react";
import { MarketplaceJobLine } from "@/components/marketplace/marketplace-job-line";
import { Button } from "@/components/ui/button";
import type { ScrapedJob } from "@/lib/scraped-jobs";
import { Sparkles } from "lucide-react";

type Props = {
  jobs: ScrapedJob[];
  onClearFilters: () => void;
  isAuthenticated: boolean;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
};

export function MarketplaceJobList({ jobs, onClearFilters, isAuthenticated, pageSizeOptions = [15, 30, 50], defaultPageSize = 15 }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPage(1);
  }, [jobs, pageSize]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    if (containerRef.current) {
      // Scroll the parent container on desktop
      const scrollParent = containerRef.current.closest('.lg\\:overflow-y-auto');
      if (scrollParent) {
        scrollParent.scrollTo({ top: 0, behavior: 'smooth' });
      }
      // Scroll the window on mobile
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxButtons = 5; // Maximum number of page buttons to show (including ellipses)

    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show page 1
      pages.push(1);

      // Calculate start and end indices around the current page
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      // Adjust if close to the beginning
      if (currentPage <= 3) {
        end = 4;
      }
      // Adjust if close to the end
      if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
      }

      // Add left ellipsis if needed
      if (start > 2) {
        pages.push("...");
      }

      // Add pages in between
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add right ellipsis if needed
      if (end < totalPages - 1) {
        pages.push("...");
      }

      // Always show the last page
      pages.push(totalPages);
    }
    return pages;
  };

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

  const totalPages = Math.max(1, Math.ceil(jobs.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const visibleJobs = jobs.slice(start, end);

  return (
    <div ref={containerRef}>
      <div className="max-sm:divide-y max-sm:divide-border/40 sm:border sm:border-border/80 sm:rounded-xl sm:bg-background sm:overflow-hidden sm:divide-y sm:divide-border/60">
        {visibleJobs.map((job) => (
          <MarketplaceJobLine key={job.id} job={job} isAuthenticated={isAuthenticated} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pt-4 pb-2">
          {/* Mobile pagination: Sleek, compact, never overflows */}
          <div className="sm:hidden flex flex-col gap-3 w-full">
            <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-3">
              <span className="text-[11px] text-muted-foreground">Jobs per page</span>
              <select
                className="h-8 border border-border/80 rounded-lg px-2 text-xs bg-background text-foreground shadow-sm"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-4">
              <Button
                type="button"
                variant="outline"
                className="h-8 flex-1 text-xs rounded-lg font-medium shadow-sm"
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                Prev
              </Button>
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                className="h-8 flex-1 text-xs rounded-lg font-medium shadow-sm"
                onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>

          {/* Desktop pagination: Smart sliding window page selector */}
          <div className="hidden sm:flex items-center justify-between gap-3 border-t border-border/40 pt-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">Jobs per page</span>
              <select
                className="h-7 border border-border/80 rounded px-1.5 text-[11px] bg-background text-foreground"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-7 px-2.5 text-[11px]"
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                Prev
              </Button>
              <div className="flex items-center gap-1">
                {getPageNumbers().map((p, idx) => {
                  if (p === "...") {
                    return (
                      <span key={`ell-${idx}`} className="px-1.5 text-xs text-muted-foreground">
                        …
                      </span>
                    );
                  }
                  const pageNum = p as number;
                  const isCurrent = pageNum === currentPage;
                  return (
                    <Button
                      key={pageNum}
                      type="button"
                      variant={isCurrent ? "default" : "outline"}
                      className={`h-7 min-w-[28px] px-1 text-[11px] rounded ${
                        isCurrent ? "bg-[#FD5D28] text-white hover:bg-[#FD5D28]/95 font-semibold" : ""
                      }`}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-7 px-2.5 text-[11px]"
                onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
