import { parseJobDeadline } from "./parse-deadline.ts";
import { firecrawlPost } from "./firecrawl-client.ts";
import { DEFAULT_JOB_SOURCES, JOB_SOURCE_SITES } from "./job-sources.ts";
import {
  hostToSourceLabel,
  isAggregatedListing,
  isLinkedInHost,
  isLinkedInJobViewUrl,
  resolveEmployerCompany,
  isLowQualityJob,
} from "./scrape-utils.ts";
import { resolveLinkedInLiAt, scrapeLinkedInJobs } from "./linkedin-jobs.ts";

export type ScrapedJob = {
  title: string;
  company: string | null;
  location: string | null;
  description: string | null;
  source_url: string;
  source: string;
  deadline: string | null;
  deadline_text: string | null;
  job_type?: string | null;
};

export type SearchKenyaJobsOptions = {
  linkedinLiAt?: string | null;
  linkedinTimeFilter?: string;
};

function mapSearchResult(r: Record<string, any>): ScrapedJob | null {
  const url: string = r.url;
  const title = r.title || "";
  if (!url || isAggregatedListing(url, title)) return null;

  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (isLinkedInHost(host) && !isLinkedInJobViewUrl(url)) return null;
  } catch {
    return null;
  }

  const body = r.markdown || r.description || r.snippet || "";
  const { deadline, deadline_text } = parseJobDeadline(body);
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "web";
    }
  })();

  const job: ScrapedJob = {
    title: title || "Untitled role",
    company: resolveEmployerCompany({
      title,
      url,
      markdown: body,
      ogSiteName: r.metadata?.ogSiteName,
    }),
    location: null,
    description: body || null,
    source_url: url,
    source: hostToSourceLabel(host),
    deadline,
    deadline_text,
  };

  if (isLowQualityJob(job)) return null;
  return job;
}

async function firecrawlSearch(query: string, limit: number): Promise<ScrapedJob[]> {
  const data = await firecrawlPost("/search", {
    query,
    limit: Math.min(Math.max(limit, 3), 25),
    scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
  });

  const results = (data?.data?.web ?? data?.data ?? []) as Record<string, any>[];
  const out: ScrapedJob[] = [];
  for (const r of results) {
    const job = mapSearchResult(r);
    if (job) out.push(job);
  }
  return out;
}

/**
 * User-facing job discovery (existing flow). Unrelated to scraped_jobs / site scrapers.
 */
export async function searchKenyaJobs(
  roles: string[],
  counties: string[],
  limit = 20,
  sources?: string[] | null,
  linkedInOpts?: SearchKenyaJobsOptions,
): Promise<ScrapedJob[]> {
  const role = roles.slice(0, 3).join(" ") || "jobs";
  const loc = counties.filter((c) => c && c.toLowerCase() !== "kenya")[0] || counties[0] || "Kenya";

  const requested = sources?.length ? sources : [...DEFAULT_JOB_SOURCES];
  const kenyanSources = requested.filter((k) => k !== "LinkedIn" && JOB_SOURCE_SITES[k]);
  const boards = kenyanSources.length ? kenyanSources : [...DEFAULT_JOB_SOURCES];
  const includeLinkedIn = requested.includes("LinkedIn");

  const perBoard = Math.max(Math.ceil(limit / boards.length), 4);
  const byUrl = new Map<string, ScrapedJob>();

  for (const board of boards) {
    const siteFilter = JOB_SOURCE_SITES[board]!.siteFilter;
    const query = `${role} ${loc} Kenya ${siteFilter}`;
    try {
      const batch = await firecrawlSearch(query, perBoard);
      for (const job of batch) {
        if (!byUrl.has(job.source_url)) byUrl.set(job.source_url, job);
      }
      console.log(`search ${board}: ${batch.length} jobs`);
    } catch (e) {
      console.error(`search failed for ${board}:`, e);
    }
  }

  if (includeLinkedIn) {
    const liAt = linkedInOpts?.linkedinLiAt ?? resolveLinkedInLiAt(null);
    if (!liAt) {
      console.warn(
        "LinkedIn enabled but no li_at cookie — add it in Settings or LINKEDIN_LI_AT env",
      );
    } else {
      try {
        const batch = await scrapeLinkedInJobs({
          roles: roles.length ? roles : [role],
          location: loc,
          liAt,
          timeFilter: linkedInOpts?.linkedinTimeFilter ?? "r86400",
          totalLimit: Math.min(perBoard * 2, limit),
        });
        for (const job of batch) {
          if (!byUrl.has(job.source_url)) byUrl.set(job.source_url, job);
        }
        console.log(`LinkedIn jobs extract: ${batch.length} individual postings`);
      } catch (e) {
        console.error("LinkedIn extract failed:", e);
      }
    }
  }

  const merged = [...byUrl.values()];
  console.log(
    `searchKenyaJobs: ${merged.length} unique jobs from ${boards.length} boards` +
      (includeLinkedIn ? " + LinkedIn" : ""),
  );

  return merged.slice(0, limit);
}

export async function scrapeUrlMarkdown(url: string): Promise<string> {
  const data = await firecrawlPost("/scrape", {
    url,
    formats: ["markdown"],
    onlyMainContent: true,
  });
  return data?.data?.markdown || data?.markdown || data?.data?.content || "";
}
