import { firecrawlGet, firecrawlPost } from "./firecrawl-client.ts";
import { parseJobDeadline } from "./parse-deadline.ts";
import type { ScrapedJob } from "./firecrawl.ts";
import {
  isAggregatedTitle,
  isLinkedInJobViewUrl,
  isLowQualityJob,
} from "./scrape-utils.ts";

export type LinkedInJobListing = {
  title: string;
  company: string | null;
  location: string | null;
  date_posted: string | null;
  job_url: string;
  employment_type: string | null;
  work_type: string | null;
};

const EXTRACT_PROMPT =
  "From this LinkedIn Jobs search results page, extract every individual job listing shown as a separate card or row. " +
  "Each item must have its own job_url pointing to https://www.linkedin.com/jobs/view/<numeric-id>. " +
  "Do not return category pages, collection pages, or aggregated pages like '30 Hub Manager jobs in Kenya'. " +
  "Include employment_type (Full-time, Contract, etc.) and work_type (Remote, Hybrid, On-site) when visible on the card.";

const JOB_LIST_SCHEMA = {
  type: "object",
  properties: {
    jobs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          company: { type: "string" },
          location: { type: "string" },
          date_posted: { type: "string" },
          job_url: { type: "string" },
          employment_type: { type: "string" },
          work_type: { type: "string" },
        },
        required: ["title", "job_url"],
      },
    },
  },
  required: ["jobs"],
};

export type LinkedInScrapeOptions = {
  roles: string[];
  location: string;
  liAt: string;
  timeFilter?: string;
  limitPerRole?: number;
  totalLimit?: number;
};

export function buildLinkedInSearchUrl(
  keywords: string,
  location: string,
  timeFilter = "r86400",
): string {
  const params = new URLSearchParams({
    keywords: keywords.trim() || "jobs",
    location: location.trim() || "Kenya",
    sortBy: "DD",
    f_TPR: timeFilter,
  });
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

function linkedInScrapeOptions(liAt: string) {
  return {
    formats: [{ type: "json", schema: JOB_LIST_SCHEMA }],
    onlyMainContent: true,
    proxy: "auto",
    headers: {
      Cookie: `li_at=${liAt}`,
    },
  };
}

export function normalizeLinkedInJobUrl(url: string): string {
  let u = url.trim();
  if (!u) return u;
  if (u.startsWith("/")) u = `https://www.linkedin.com${u}`;
  if (!u.startsWith("http")) u = `https://www.linkedin.com/${u.replace(/^\//, "")}`;
  try {
    const parsed = new URL(u);
    const m = parsed.pathname.match(/\/jobs\/view\/(\d+)/i);
    if (m) return `https://www.linkedin.com/jobs/view/${m[1]}`;
  } catch {
    /* keep */
  }
  return u;
}

function parseExtractJobs(data: unknown): LinkedInJobListing[] {
  if (!data || typeof data !== "object") return [];
  const raw = data as Record<string, unknown>;
  const jobsField = raw.jobs;
  const list = Array.isArray(jobsField) ? jobsField : [];
  return list
    .filter((j): j is Record<string, unknown> => !!j && typeof j === "object")
    .map((j) => ({
      title: String(j.title ?? "").trim(),
      company: j.company ? String(j.company).trim() : null,
      location: j.location ? String(j.location).trim() : null,
      date_posted: j.date_posted ? String(j.date_posted).trim() : null,
      job_url: normalizeLinkedInJobUrl(String(j.job_url ?? j.url ?? "")),
      employment_type: j.employment_type ? String(j.employment_type).trim() : null,
      work_type: j.work_type ? String(j.work_type).trim() : null,
    }))
    .filter((j) => j.title && j.job_url && isLinkedInJobViewUrl(j.job_url) && !isAggregatedTitle(j.title));
}

async function pollExtract(id: string, maxAttempts = 30): Promise<unknown> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await firecrawlGet(`/extract/${id}`);
    const status = res.status as string | undefined;
    if ((status === "completed" || res.success === true) && res.data) {
      return res.data;
    }
    if (status === "failed" || status === "cancelled") {
      throw new Error(`LinkedIn extract ${status}: ${res.error ?? "unknown"}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("LinkedIn extract timed out");
}

async function extractLinkedInSearchPage(
  searchUrl: string,
  liAt: string,
): Promise<LinkedInJobListing[]> {
  const res = await firecrawlPost("/extract", {
    urls: [searchUrl],
    prompt: EXTRACT_PROMPT,
    schema: JOB_LIST_SCHEMA,
    scrapeOptions: linkedInScrapeOptions(liAt),
    ignoreInvalidURLs: true,
  });

  let data: unknown = res.data;
  if (res.id && !data) {
    data = await pollExtract(String(res.id));
  }
  const listings = parseExtractJobs(data);
  if (listings.length > 0) return listings;

  const scrapeRes = await firecrawlPost("/scrape", {
    url: searchUrl,
    ...linkedInScrapeOptions(liAt),
  });
  const json = scrapeRes?.data && typeof scrapeRes.data === "object"
    ? (scrapeRes.data as Record<string, unknown>).json
    : scrapeRes.json;
  return parseExtractJobs(json);
}

export function linkedInListingToScrapedJob(j: LinkedInJobListing): ScrapedJob | null {
  const url = normalizeLinkedInJobUrl(j.job_url);
  if (!isLinkedInJobViewUrl(url) || isAggregatedTitle(j.title)) return null;

  const locParts = [j.location, j.work_type].filter(Boolean);
  const location = locParts.length ? locParts.join(" · ") : null;
  const { deadline, deadline_text } = parseJobDeadline(j.date_posted ?? "");

  const job: ScrapedJob = {
    title: j.title,
    company: j.company?.trim() || null,
    location,
    description: null,
    source_url: url,
    source: "LinkedIn",
    deadline,
    deadline_text: j.date_posted ?? deadline_text,
    job_type: j.employment_type,
  };
  if (isLowQualityJob(job)) return null;
  return job;
}

export async function scrapeLinkedInJobs(opts: LinkedInScrapeOptions): Promise<ScrapedJob[]> {
  const {
    roles,
    location,
    liAt,
    timeFilter = "r86400",
    totalLimit = 25,
  } = opts;

  if (!liAt?.trim()) {
    console.warn("LinkedIn scrape skipped: no li_at cookie");
    return [];
  }

  const roleQueries = roles.length ? roles.slice(0, 4) : ["jobs"];
  const byUrl = new Map<string, ScrapedJob>();

  for (const role of roleQueries) {
    const searchUrl = buildLinkedInSearchUrl(role, location, timeFilter);
    try {
      const listings = await extractLinkedInSearchPage(searchUrl, liAt.trim());
      for (const item of listings) {
        const job = linkedInListingToScrapedJob(item);
        if (job && !byUrl.has(job.source_url)) byUrl.set(job.source_url, job);
        if (byUrl.size >= totalLimit) break;
      }
      console.log(
        `LinkedIn extract "${role}" @ ${location}: ${listings.length} listings, ${byUrl.size} kept`,
      );
    } catch (e) {
      console.error(`LinkedIn extract failed for "${role}":`, e);
    }
    if (byUrl.size >= totalLimit) break;
  }

  return [...byUrl.values()].slice(0, totalLimit);
}

export function resolveLinkedInLiAt(
  integration?: { linkedin_li_at?: string | null } | null,
): string | null {
  const fromUser = integration?.linkedin_li_at?.trim();
  if (fromUser) return fromUser;
  return Deno.env.get("LINKEDIN_LI_AT")?.trim() || null;
}
