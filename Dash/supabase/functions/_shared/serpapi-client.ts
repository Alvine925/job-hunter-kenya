/**
 * SerpAPI fallback when ScrapingBee fails (quota, 401, timeout).
 * https://serpapi.com/search-api
 */
export type SerpSiteId =
  | "fuzu"
  | "brightermonday"
  | "myjobmag"
  | "myjobsinkenya"
  | "linkedin";

const SERP_ENDPOINT = "https://serpapi.com/search.json";

export function hasSerpApiKey(): boolean {
  return !!(Deno.env.get("SERPAPI_API_KEY") ?? Deno.env.get("SERPAPI_KEY"))?.trim();
}

function serpApiKey(): string {
  const key = Deno.env.get("SERPAPI_API_KEY") ?? Deno.env.get("SERPAPI_KEY");
  if (!key?.trim()) throw new Error("SERPAPI_API_KEY missing");
  return key.trim();
}

export async function serpApiRequest(
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ ...params, api_key: serpApiKey() });
  const res = await fetch(`${SERP_ENDPOINT}?${qs.toString()}`);
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`SerpAPI ${res.status}: ${body.slice(0, 400)}`);
  }
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new Error("SerpAPI returned non-JSON response");
  }
}

const SITE_SERP: Record<
  SerpSiteId,
  { siteQuery: string; jobsQuery?: string }
> = {
  fuzu: { siteQuery: "site:fuzu.com/jobs", jobsQuery: "jobs Kenya" },
  brightermonday: {
    siteQuery: "site:brightermonday.co.ke/listings",
    jobsQuery: "jobs Kenya",
  },
  myjobmag: { siteQuery: "site:myjobmag.co.ke/job", jobsQuery: "jobs Kenya" },
  myjobsinkenya: {
    siteQuery: "site:myjobsinkenya.com/jobs",
    jobsQuery: "jobs Kenya",
  },
  linkedin: { siteQuery: "site:linkedin.com/jobs/view", jobsQuery: "jobs Kenya" },
};

/** Discover job URLs via Google / Google Jobs when ScrapingBee cannot fetch listing HTML. */
export async function serpApiDiscoverJobUrls(
  site: SerpSiteId,
  limit: number,
): Promise<string[]> {
  const cfg = SITE_SERP[site];
  const urls: string[] = [];

  if (site === "linkedin") {
    const data = await serpApiRequest({
      engine: "google_jobs",
      q: cfg.jobsQuery ?? "jobs",
      location: "Kenya",
      google_domain: "google.com",
      hl: "en",
      gl: "ke",
    });
    const jobs = (data.jobs_results ?? []) as Array<Record<string, unknown>>;
    for (const job of jobs) {
      const link = String(
        job.apply_link ?? job.share_link ?? job.link ?? "",
      ).trim();
      if (link.startsWith("http")) urls.push(link);
      const opts = job.apply_options as Array<{ link?: string }> | undefined;
      for (const o of opts ?? []) {
        if (o?.link?.startsWith("http")) urls.push(o.link);
      }
    }
  } else {
    const data = await serpApiRequest({
      engine: "google",
      q: `${cfg.siteQuery} ${cfg.jobsQuery ?? ""}`.trim(),
      google_domain: "google.com",
      hl: "en",
      gl: "ke",
      num: String(Math.min(20, limit * 3)),
    });
    const organic = (data.organic_results ?? []) as Array<{ link?: string }>;
    for (const row of organic) {
      if (row.link?.startsWith("http")) urls.push(row.link);
    }
  }

  return urls;
}

/** Build page text from SerpAPI snippets when ScrapingBee cannot fetch HTML. */
export async function serpApiJobPageText(url: string, site: SerpSiteId): Promise<string> {
  let host = "";
  let path = "";
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, "");
    path = u.pathname;
  } catch {
    throw new Error(`Invalid URL for SerpAPI: ${url}`);
  }

  const data = await serpApiRequest({
    engine: "google",
    q: `site:${host} ${path.split("/").filter(Boolean).slice(-2).join(" ")}`.trim(),
    google_domain: "google.com",
    hl: "en",
    gl: "ke",
    num: "5",
  });

  const parts: string[] = [`Source URL: ${url}`, `Job board: ${site}`];
  const organic = (data.organic_results ?? []) as Array<{
    title?: string;
    link?: string;
    snippet?: string;
  }>;

  for (const row of organic) {
    if (row.link && !row.link.includes(host)) continue;
    if (row.title) parts.push(`Title: ${row.title}`);
    if (row.snippet) parts.push(row.snippet);
  }

  const answer = data.answer_box as Record<string, unknown> | undefined;
  if (answer?.snippet) parts.push(String(answer.snippet));
  if (answer?.answer) parts.push(String(answer.answer));

  const text = parts.join("\n\n").trim();
  if (text.length < 80) {
    throw new Error(`SerpAPI returned insufficient text for ${url}`);
  }
  return text.slice(0, 45_000);
}
