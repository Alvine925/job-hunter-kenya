import { searchKenyaJobs, type ScrapedJob } from "./firecrawl.ts";
import { analyzeScrapedJob } from "./job-enrichment.ts";
import { isDeadlineActive, todayIsoDate } from "./parse-deadline.ts";
import { hostMatchesSources, resolveSourceHosts } from "./job-sources.ts";
import { isLowQualityJobForAttach } from "./scrape-utils.ts";
import { resolveCompanyLogoUrl } from "./logo-utils.ts";

export type JobListingRow = {
  id: string;
  source_url: string;
  title: string;
  company: string | null;
  company_summary: string | null;
  role_description: string | null;
  location: string | null;
  county: string | null;
  description: string | null;
  requirements: string | null;
  responsibilities: string | null;
  salary_text: string | null;
  job_type: string | null;
  source: string | null;
  application_email: string | null;
  application_url: string | null;
  application_method: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  deadline: string | null;
  deadline_text: string | null;
  scraped_at: string;
};

function uniqueBySourceUrl<T extends { source_url: string }>(jobs: T[]) {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    if (seen.has(job.source_url)) return false;
    seen.add(job.source_url);
    return true;
  });
}

function listingToScrapedJob(listing: JobListingRow): ScrapedJob {
  return {
    title: listing.title,
    company: listing.company,
    location: listing.location,
    description: listing.description,
    source_url: listing.source_url,
    source: listing.source ?? "",
    deadline: listing.deadline,
    deadline_text: listing.deadline_text,
  };
}

/** Search shared catalog for active listings matching roles (DB-first). */
export async function searchCatalogListings(
  supabase: any,
  params: {
    roles: string[];
    counties: string[];
    sources: string[] | null;
    limit: number;
  },
): Promise<JobListingRow[]> {
  const { roles, counties, sources, limit } = params;
  const hosts = resolveSourceHosts(sources);
  const today = todayIsoDate();

  let query = supabase
    .from("job_listings")
    .select("*")
    .or(`deadline.is.null,deadline.gte.${today}`)
    .order("scraped_at", { ascending: false })
    .limit(Math.min(limit * 3, 60));

  if (hosts.length > 0) {
    const hostFilter = hosts.map((h) => `source.ilike.%${h}%`).join(",");
    query = query.or(hostFilter);
  }

  const { data, error } = await query;
  if (error) {
    console.error("catalog search error:", error);
    return [];
  }

  const roleTerms = roles.map((r) => r.trim().toLowerCase()).filter(Boolean);
  const countyTerms = counties.map((c) => c.trim().toLowerCase()).filter(
    (c) => c && c !== "kenya",
  );

  const filtered = (data ?? []).filter((row: JobListingRow) => {
    if (!isDeadlineActive(row.deadline, today)) return false;
    if (!hostMatchesSources(row.source ?? "", sources)) return false;

    const hay = `${row.title} ${row.description ?? ""} ${row.location ?? ""} ${row.county ?? ""}`
      .toLowerCase();

    const roleMatch = roleTerms.length === 0 ||
      roleTerms.some((t) => hay.includes(t));
    const countyMatch = countyTerms.length === 0 ||
      countyTerms.some((t) => hay.includes(t));

    return roleMatch && countyMatch;
  });

  return filtered.slice(0, limit) as JobListingRow[];
}

export async function upsertJobListing(
  supabase: any,
  row: Record<string, unknown>,
): Promise<JobListingRow | null> {
  const { data, error } = await supabase
    .from("job_listings")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "source_url" })
    .select()
    .single();
  if (error) {
    console.error("listing upsert error:", error);
    return null;
  }
  return data as JobListingRow;
}

export async function upsertListingsFromScrape(
  supabase: any,
  scraped: ScrapedJob[],
): Promise<JobListingRow[]> {
  const today = todayIsoDate();
  const active = scraped.filter((j) => isDeadlineActive(j.deadline, today));
  const out: JobListingRow[] = [];

  for (const job of uniqueBySourceUrl(active)) {
    const listing = await upsertJobListing(supabase, {
      source_url: job.source_url,
      title: job.title,
      company: job.company,
      logo_url: resolveCompanyLogoUrl(job.company ?? ""),
      location: job.location,
      description: job.description,
      source: job.source,
      deadline: job.deadline,
      deadline_text: job.deadline_text,
      job_type: job.job_type ?? null,
      scraped_at: new Date().toISOString(),
    });
    if (listing) out.push(listing);
  }
  return out;
}

export async function enrichListingWithAnalysis(
  supabase: any,
  listing: JobListingRow,
  analysis: Record<string, any>,
): Promise<JobListingRow | null> {
  return upsertJobListing(supabase, {
    source_url: listing.source_url,
    title: listing.title,
    company: analysis.company ?? listing.company,
    logo_url: resolveCompanyLogoUrl(analysis.company ?? listing.company ?? ""),
    company_summary: analysis.company_summary ?? listing.company_summary,
    role_description: analysis.role_description ?? listing.role_description,
    location: analysis.location ?? listing.location,
    county: analysis.county ?? listing.county,
    description: analysis.description ?? listing.description,
    requirements: analysis.requirements ?? listing.requirements,
    responsibilities: analysis.responsibilities ?? listing.responsibilities,
    salary_text: analysis.salary_text ?? listing.salary_text,
    job_type: analysis.job_type ?? listing.job_type,
    source: listing.source,
    application_email: analysis.application_email ?? listing.application_email,
    application_url: analysis.application_url ?? listing.application_url ?? listing.source_url,
    application_method: analysis.application_method ?? listing.application_method,
    contact_person: analysis.contact_person ?? listing.contact_person,
    contact_phone: analysis.contact_phone ?? listing.contact_phone,
    deadline: listing.deadline ?? analysis.deadline ?? null,
    deadline_text: listing.deadline_text ?? analysis.deadline_text ?? null,
    scraped_at: listing.scraped_at,
  });
}

export type DiscoverJobsResult = {
  listings: JobListingRow[];
  fromCache: number;
  fromScrape: number;
  skippedExpired: number;
};

/**
 * DB-first job discovery: reuse catalog, scrape only when needed.
 */
export async function discoverJobListings(
  supabase: any,
  params: {
    roles: string[];
    counties: string[];
    sources: string[] | null;
    limit: number;
    linkedinLiAt?: string | null;
    linkedinTimeFilter?: string | null;
  },
): Promise<DiscoverJobsResult> {
  const { roles, counties, sources, limit, linkedinLiAt, linkedinTimeFilter } = params;
  const today = todayIsoDate();

  const cached = await searchCatalogListings(supabase, { roles, counties, sources, limit });
  const byUrl = new Map<string, JobListingRow>();
  for (const l of cached) byUrl.set(l.source_url, l);

  let fromScrape = 0;
  let skippedExpired = 0;

  if (byUrl.size < limit) {
    const scrapeLimit = Math.max(limit - byUrl.size, 5) * 2;
    const scraped = uniqueBySourceUrl(
      await searchKenyaJobs(roles, counties, scrapeLimit, sources, {
        linkedinLiAt,
        linkedinTimeFilter: linkedinTimeFilter ?? undefined,
      }),
    );

    const activeScraped = scraped.filter((j) => {
      if (!isDeadlineActive(j.deadline, today)) {
        skippedExpired++;
        return false;
      }
      return true;
    });

    const newListings = await upsertListingsFromScrape(supabase, activeScraped);
    fromScrape = newListings.length;
    for (const l of newListings) {
      if (!byUrl.has(l.source_url) && byUrl.size < limit) byUrl.set(l.source_url, l);
    }
  }

  return {
    listings: [...byUrl.values()].slice(0, limit),
    fromCache: cached.length,
    fromScrape,
    skippedExpired,
  };
}

export async function attachJobsForUser(
  supabase: any,
  catalogAdmin: any,
  userId: string,
  listings: JobListingRow[],
  profileSummary: string,
  matchingTemplate: string | null,
): Promise<{ job: any; listing: JobListingRow; analysis: any }[]> {
  const { data: existingJobs } = await supabase
    .from("jobs")
    .select("source_url, title, company")
    .eq("user_id", userId);

  const haveUrl = new Set<string>();
  const haveTitleCompany = new Set<string>();

  for (const ej of (existingJobs ?? [])) {
    if (ej.source_url) {
      haveUrl.add(ej.source_url.toLowerCase().trim());
    }
    const key = `${(ej.title ?? "").toLowerCase().trim()}|${(ej.company ?? "").toLowerCase().trim()}`;
    haveTitleCompany.add(key);
  }

  const results: { job: any; listing: JobListingRow; analysis: any }[] = [];

  for (const listing of listings) {
    const urlKey = (listing.source_url ?? "").toLowerCase().trim();
    if (haveUrl.has(urlKey)) continue;

    const titleCompanyKey = `${(listing.title ?? "").toLowerCase().trim()}|${(listing.company ?? "").toLowerCase().trim()}`;
    if (haveTitleCompany.has(titleCompanyKey)) continue;

    try {
      const analysis = await analyzeScrapedJob({
        profileSummary,
        job: listingToScrapedJob(listing),
        matchingTemplate,
      });

      const enrichedListing = await enrichListingWithAnalysis(catalogAdmin, listing, {
        ...analysis,
        deadline: listing.deadline ?? analysis.deadline ?? null,
      });

      const record = {
        title: listing.title,
        company: analysis.company ?? listing.company,
        source_url: listing.source_url,
        role_description: analysis.role_description,
        requirements: analysis.requirements,
        responsibilities: analysis.responsibilities,
      };
      if (isLowQualityJobForAttach(record)) {
        console.log("skip attaching low-quality job:", record.title, record.company);
        continue;
      }

      const { data: inserted, error } = await supabase
        .from("jobs")
        .insert({
          user_id: userId,
          listing_id: enrichedListing?.id ?? listing.id,
          title: listing.title,
          company: analysis.company ?? listing.company,
          logo_url: resolveCompanyLogoUrl(analysis.company ?? listing.company ?? ""),
          company_summary: analysis.company_summary ?? null,
          role_description: analysis.role_description ?? null,
          location: analysis.location ?? listing.location,
          county: analysis.county ?? listing.county,
          description: analysis.description ?? listing.description,
          requirements: analysis.requirements ?? listing.requirements,
          responsibilities: analysis.responsibilities ?? listing.responsibilities,
          salary_text: analysis.salary_text ?? listing.salary_text,
          job_type: analysis.job_type ?? listing.job_type,
          source: listing.source,
          source_url: listing.source_url,
          application_email: analysis.application_email ?? listing.application_email,
          application_url: analysis.application_url || listing.application_url || listing.source_url,
          application_method: analysis.application_email
            ? "email"
            : analysis.application_method === "form"
            ? "form"
            : listing.application_method ?? "unknown",
          contact_person: analysis.contact_person ?? listing.contact_person,
          contact_phone: analysis.contact_phone ?? listing.contact_phone,
          deadline: listing.deadline ?? analysis.deadline ?? null,
          match_score: analysis.match_score ?? 50,
          match_reason: analysis.match_reason ?? null,
          match_strengths: analysis.match_strengths ?? null,
          match_gaps: analysis.match_gaps ?? null,
          tracker_status: "new",
        })
        .select()
        .single();

      if (error) throw error;
      results.push({ job: inserted, listing: enrichedListing ?? listing, analysis });
    } catch (e) {
      console.error("attach job failed", listing.source_url, e);
    }
  }

  return results;
}
