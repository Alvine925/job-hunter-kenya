/**
 * Daily site scrapers (ScrapingBee + AI) → public.scraped_jobs only.
 * Does NOT call discoverJobListings, job_listings, or user jobs attach flow.
 */
import { aiJson } from "./ai.ts";
import { analyzeBoardJobListing } from "./scraped-job-analyst.ts";
import { createAdminClient } from "./supabase.ts";
import { discoverJobUrlsWithFallback, fetchPageText } from "./page-fetch.ts";
import {
  isLinkedInJobViewUrl,
  isLowQualityJob,
  sourceLabelFromUrl,
} from "./scrape-utils.ts";
import { buildLinkedInSearchUrl, normalizeLinkedInJobUrl } from "./linkedin-jobs.ts";

const ALLOWED_ORIGINS = [
  "https://www.tellusjobs.site",
  "https://tellusjobs.site",
  "https://myjobs.tellusjobs.site",
  "https://dash.tellusjobs.site",
  "https://tellus-jobs-kybc4uvbw-alvine925s-projects.vercel.app",
];

export function getCorsHeaders(origin: string | null) {
  let allowedOrigin = "https://www.tellusjobs.site";
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) {
      allowedOrigin = origin;
    } else if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      allowedOrigin = origin;
    }
  }
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scrape-secret",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.tellusjobs.site",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-scrape-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export type SiteId =
  | "fuzu"
  | "brightermonday"
  | "myjobmag"
  | "myjobsinkenya"
  | "linkedin";

export type ScrapedJobRow = {
  source: string;
  source_url: string;
  title: string;
  company: string | null;
  company_summary: string | null;
  role_description: string | null;
  location: string | null;
  county: string | null;
  description: string | null;
  description_summary: string | null;
  requirements: string | null;
  responsibilities: string | null;
  job_type: string | null;
  work_type: string | null;
  salary_text: string | null;
  application_url: string | null;
  application_email: string | null;
  application_method: string;
  contact_person: string | null;
  contact_phone: string | null;
  deadline: string | null;
  deadline_text: string | null;
  sector: string | null;
  experience_level: string | null;
  education_level: string | null;
};

const SITE_CONFIG: Record<
  SiteId,
  {
    label: string;
    listingUrl: string;
    renderJs: boolean;
    urlPatterns: RegExp[];
    baseHost: string;
  }
> = {
  fuzu: {
    label: "Fuzu",
    listingUrl: "https://www.fuzu.com/jobs",
    renderJs: true,
    urlPatterns: [/fuzu\.com\/job/i, /fuzu\.com\/jobs\//i],
    baseHost: "https://www.fuzu.com",
  },
  brightermonday: {
    label: "BrighterMonday",
    listingUrl: "https://www.brightermonday.co.ke/jobs",
    renderJs: true,
    urlPatterns: [/brightermonday\.co\.ke\/listings\//i],
    baseHost: "https://www.brightermonday.co.ke",
  },
  myjobmag: {
    label: "MyJobMag",
    listingUrl: "https://www.myjobmag.co.ke/jobs",
    renderJs: false,
    urlPatterns: [/myjobmag\.co\.ke\/job\//i],
    baseHost: "https://www.myjobmag.co.ke",
  },
  myjobsinkenya: {
    label: "MyJobsInKenya",
    listingUrl: "https://www.myjobsinkenya.com/#recent",
    renderJs: true,
    urlPatterns: [/myjobsinkenya\.com\/jobs\/.+\/view/i, /myjobsinkenya\.com\/jobs\//i],
    baseHost: "https://www.myjobsinkenya.com",
  },
  linkedin: {
    label: "LinkedIn",
    listingUrl: "https://www.linkedin.com/jobs/search/?keywords=jobs&location=Kenya&sortBy=DD&f_TPR=r604800",
    renderJs: true,
    urlPatterns: [/linkedin\.com\/jobs\/view\/\d+/i],
    baseHost: "https://www.linkedin.com",
  },
};

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return null;
}

/** True when token is a Supabase JWT for this project's service_role. */
function isProjectServiceRoleJwt(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64)) as { role?: string; ref?: string; iss?: string };
    if (payload.role !== "service_role") return false;
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (ref && payload.ref && payload.ref !== ref) return false;
    if (payload.iss !== "supabase" && !String(payload.iss ?? "").includes("supabase")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Accept only private cron/manual/service-role secrets. Never accept publishable/anon keys. */
export function authorizeRequest(req: Request): Response | null {
  const bearer = extractBearerToken(req);
  const apikey = req.headers.get("apikey")?.trim() ?? null;
  const token = bearer ?? apikey;

  const allowed = new Set(
    [
      Deno.env.get("CRON_SECRET"),
      Deno.env.get("SCRAPE_MANUAL_SECRET"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    ].filter((v): v is string => !!v && v.length > 0),
  );

  if (token && allowed.has(token)) return null;
  if (token && isProjectServiceRoleJwt(token)) return null;

  const scrapeHeader = req.headers.get("x-scrape-secret");
  const manualSecret = Deno.env.get("SCRAPE_MANUAL_SECRET");
  if (manualSecret && scrapeHeader === manualSecret) return null;

  return new Response(
    JSON.stringify({
      ok: false,
      error: "Unauthorized",
      hint:
        "Use Project Settings -> API -> service_role (secret JWT) in Authorization and apikey headers. Publishable sb_publishable_* keys are not accepted for scrapers.",
    }),
    {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

function normalizeUrl(href: string, base: string): string | null {
  try {
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return null;
    const u = href.startsWith("http") ? new URL(href) : new URL(href, base);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function filterJobUrls(urls: string[], site: SiteId): string[] {
  const cfg = SITE_CONFIG[site];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const u = normalizeUrl(raw, cfg.baseHost);
    if (!u || seen.has(u)) continue;
    if (!cfg.urlPatterns.some((p) => p.test(u))) continue;
    if (site === "linkedin" && !isLinkedInJobViewUrl(u)) continue;
    seen.add(u);
    out.push(site === "linkedin" ? normalizeLinkedInJobUrl(u) : u);
  }
  return out;
}

async function extractJobUrlsFromListing(
  pageText: string,
  site: SiteId,
  limit: number,
): Promise<string[]> {
  const cfg = SITE_CONFIG[site];
  const data = await aiJson<{ urls: string[] }>(
    `Extract individual job posting URLs from this ${cfg.label} jobs listing page text.
Return JSON: { "urls": ["https://...", ...] }
Rules:
- Only real job detail pages on ${cfg.baseHost}, not category/search pages.
- Absolute URLs only, max ${limit} most recent-looking listings.
- For BrighterMonday use /listings/ URLs.
- For MyJobMag use /job/ URLs.
- For MyJobsInKenya use /jobs/.../view URLs.
- For Fuzu use job detail URLs on fuzu.com.
- For LinkedIn only /jobs/view/<id> URLs.

PAGE TEXT:
${pageText.slice(0, 50_000)}`,
    "You extract job posting URLs from scraped HTML text. Return valid JSON only.",
  );
  return filterJobUrls(data.urls ?? [], site).slice(0, limit);
}

async function upsertScrapedJob(row: ScrapedJobRow): Promise<boolean> {
  const admin = createAdminClient();
  const board = sourceLabelFromUrl(row.source_url, row.source);
  const payload = { ...row, source: board, site: board };
  const { error } = await admin.from("scraped_jobs").upsert(payload, { onConflict: "source_url" });
  if (error) {
    console.error("upsert scraped_jobs failed", row.source_url, error);
    return false;
  }
  return true;
}

function scrapingBeeOpts(site: SiteId) {
  const cfg = SITE_CONFIG[site];
  let cookies: string | undefined;
  if (site === "linkedin") {
    const liAt = Deno.env.get("LINKEDIN_LI_AT")?.trim();
    if (liAt) cookies = `li_at=${liAt}`;
  }
  return {
    renderJs: cfg.renderJs,
    premiumProxy: true,
    countryCode: "ke",
    waitMs: cfg.renderJs ? 3000 : 1500,
    cookies,
  };
}

async function fetchPage(url: string, site: SiteId): Promise<string> {
  const { text, via } = await fetchPageText(url, site, scrapingBeeOpts(site));
  console.log(`[${site}] fetched ${url} via ${via}`);
  return text;
}

/** Cap jobs per edge invocation to avoid WORKER_RESOURCE_LIMIT (~150s timeout). */
export function resolveScrapeJobLimit(requested: number): number {
  const maxPerRun = Number(Deno.env.get("SCRAPER_MAX_JOBS_PER_RUN") ?? "5");
  const cap = Number.isFinite(maxPerRun) && maxPerRun > 0 ? maxPerRun : 5;
  return Math.min(50, Math.max(1, requested), cap);
}

export async function scrapeSite(
  site: SiteId,
  limit = 15,
): Promise<{
  site: SiteId;
  listingUrl: string;
  urlsFound: number;
  scraped: number;
  skipped: number;
  errors: string[];
}> {
  const cfg = SITE_CONFIG[site];
  const jobLimit = resolveScrapeJobLimit(limit);
  const errors: string[] = [];
  let listingUrl = cfg.listingUrl;

  if (site === "linkedin") {
    const liAt = Deno.env.get("LINKEDIN_LI_AT")?.trim();
    if (!liAt) {
      throw new Error("LINKEDIN_LI_AT required for LinkedIn scraping");
    }
    listingUrl = buildLinkedInSearchUrl("jobs", "Kenya", "r604800");
  }

  console.log(`[${site}] fetching listing ${listingUrl} (limit=${jobLimit})`);
  const { urls: discovered, via: listingVia } = await discoverJobUrlsWithFallback(
    site,
    jobLimit,
    async () => {
      const listingText = await fetchPage(listingUrl, site);
      return await extractJobUrlsFromListing(listingText, site, jobLimit);
    },
  );
  const jobUrls = filterJobUrls(discovered, site).slice(0, jobLimit);
  console.log(`[${site}] ${jobUrls.length} job URLs (listing via ${listingVia})`);

  let scraped = 0;
  let skipped = 0;

  for (const jobUrl of jobUrls) {
    try {
      const detailText = await fetchPage(jobUrl, site);
      console.log(`[${site}] AI analyst ${jobUrl}`);
      const row = await analyzeBoardJobListing({
        sourceUrl: jobUrl,
        pageText: detailText,
        fallbackSource: cfg.label,
      });
      if (!row) {
        skipped++;
        continue;
      }

      if (isLowQualityJob({
        title: row.title,
        company: row.company,
        source_url: row.source_url,
        description: row.description_summary ?? row.description,
      })) {
        skipped++;
        continue;
      }

      const ok = await upsertScrapedJob(row);
      if (ok) scraped++;
      else skipped++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${jobUrl}: ${msg}`);
      console.error(`[${site}] detail failed`, jobUrl, e);
    }
  }

  return {
    site,
    listingUrl,
    urlsFound: jobUrls.length,
    scraped,
    skipped,
    errors,
    listingVia,
  };
}

export async function scrapeAllSites(limitPerSite = 12): Promise<Record<string, unknown>[]> {
  const sites: SiteId[] = [
    "fuzu",
    "brightermonday",
    "myjobmag",
    "myjobsinkenya",
    "linkedin",
  ];
  const results: Record<string, unknown>[] = [];
  for (const site of sites) {
    try {
      if (site === "linkedin" && !Deno.env.get("LINKEDIN_LI_AT")?.trim()) {
        results.push({ site, skipped: true, reason: "LINKEDIN_LI_AT not set" });
        continue;
      }
      results.push(await scrapeSite(site, limitPerSite));
    } catch (e) {
      results.push({
        site,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}
