import type { QueryClient } from "@tanstack/react-query";
import { listJobs } from "@/lib/api";
import { listScrapedJobs } from "@/lib/scraped-jobs";

const MARKETPLACE_STALE_MS = 60_000;

/** Query roots that hold per-user data — must not leak across accounts on the same browser. */
const USER_SCOPED_QUERY_ROOTS = [
  "jobs",
  "saved-jobs",
  "job",
  "profile",
  "profile-skills",
  "my-profile",
  "current_user_auth",
  "user_integrations",
  "templates",
  "agent-templates",
  "workflows",
  "workflow",
  "job-monitors",
  "interview-quiz",
  "cv-preview",
] as const;

export function clearUserScopedQueries(queryClient: QueryClient) {
  for (const root of USER_SCOPED_QUERY_ROOTS) {
    queryClient.removeQueries({ queryKey: [root] });
  }
}

/**
 * Warm React Query cache before navigating to marketplace so the page renders from cache.
 * - scraped_jobs: shared catalog (same for every user)
 * - jobs: this user's matched/saved jobs (must run after session is ready)
 */
export async function prefetchMarketplaceQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["scraped_jobs", "all"],
      queryFn: () => listScrapedJobs({ limit: 200 }),
      staleTime: MARKETPLACE_STALE_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: ["jobs"],
      queryFn: () => listJobs(),
      staleTime: MARKETPLACE_STALE_MS,
    }),
  ]);
}
