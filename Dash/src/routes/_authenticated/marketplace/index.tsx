import { createFileRoute } from "@tanstack/react-router";
import { MarketplacePage } from "@/components/marketplace/marketplace-page";
import { queryClient } from "@/lib/query-client";
import { listScrapedJobs } from "@/lib/scraped-jobs";

const MARKETPLACE_STALE_MS = 60_000;

export const Route = createFileRoute("/_authenticated/marketplace/")({
  head: () => ({
    title: "Job Marketplace - Tellus",
    meta: [
      { title: "Job Marketplace - Tellus" },
      { name: "description", content: "Explore open job listings aggregated from across major career portals." },
    ],
  }),
  // Non-blocking prefetch: warm the shared marketplace catalog without waiting
  // on per-user jobs. The user-scoped request can be slower and should not
  // compete with the first paint when the sidebar link is clicked.
  beforeLoad: () => {
    queryClient.prefetchQuery({
      queryKey: ["scraped_jobs", "all"],
      queryFn: () => listScrapedJobs({ limit: 200 }),
      staleTime: MARKETPLACE_STALE_MS,
    });
  },
  component: MarketplacePage,
});
