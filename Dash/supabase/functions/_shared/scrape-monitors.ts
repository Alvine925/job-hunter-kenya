import { scrapeUrlMarkdown } from "./firecrawl.ts";
import { extractJobsFromMonitorPage } from "./job-agents.ts";
import {
  attachJobsForUser,
  upsertListingsFromScrape,
  type JobListingRow,
} from "./job-catalog.ts";
import { parseJobDeadline, isDeadlineActive, todayIsoDate } from "./parse-deadline.ts";
import type { ScrapedJob } from "./firecrawl.ts";

export type JobMonitorRow = {
  id: string;
  user_id: string;
  name: string;
  url: string;
  notes: string | null;
  active: boolean;
  scrape_frequency: "manual" | "daily" | "weekly";
  last_scraped_at: string | null;
  last_scrape_status: string | null;
  last_scrape_error: string | null;
  last_jobs_found: number;
};

export function normalizeMonitorJobUrl(monitorUrl: string, jobUrl: string): string {
  try {
    return new URL(jobUrl, monitorUrl).toString().replace(/\/$/, "");
  } catch {
    return jobUrl;
  }
}

function monitorHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "custom";
  }
}

export function scrapedFromMonitorJobs(
  monitor: JobMonitorRow,
  extracted: {
    title: string;
    source_url: string;
    company?: string | null;
    description?: string | null;
    deadline?: string | null;
    deadline_text?: string | null;
  }[],
): ScrapedJob[] {
  const host = monitorHost(monitor.url);
  const today = todayIsoDate();

  return extracted
    .map((j) => {
      const source_url = normalizeMonitorJobUrl(monitor.url, j.source_url);
      const body = j.description ?? "";
      const parsed = parseJobDeadline(body);
      return {
        title: j.title,
        company: j.company ?? monitor.name,
        location: null,
        description: body || null,
        source_url,
        source: host,
        deadline: j.deadline ?? parsed.deadline,
        deadline_text: j.deadline_text ?? parsed.deadline_text,
      };
    })
    .filter((j) => isDeadlineActive(j.deadline, today));
}

export async function scrapeJobMonitor(params: {
  catalogAdmin: any;
  userSupabase: any;
  userId: string;
  monitor: JobMonitorRow;
  profileSummary: string;
  matchingTemplate: string | null;
}): Promise<{
  ok: boolean;
  jobsFound: number;
  jobsAttached: number;
  error?: string;
}> {
  const { catalogAdmin, userSupabase, userId, monitor, profileSummary, matchingTemplate } = params;

  try {
    const markdown = await scrapeUrlMarkdown(monitor.url);
    if (!markdown?.trim()) {
      throw new Error("Page returned no content — check the URL is public and correct.");
    }

    const { jobs: extracted } = await extractJobsFromMonitorPage({
      monitorUrl: monitor.url,
      monitorName: monitor.name,
      markdown,
    });

    if (!extracted.length) {
      await userSupabase
        .from("job_monitors")
        .update({
          last_scraped_at: new Date().toISOString(),
          last_scrape_status: "success",
          last_scrape_error: null,
          last_jobs_found: 0,
        })
        .eq("id", monitor.id)
        .eq("user_id", userId);

      return { ok: true, jobsFound: 0, jobsAttached: 0 };
    }

    const scraped = scrapedFromMonitorJobs(monitor, extracted);
    const listings = await upsertListingsFromScrape(catalogAdmin, scraped);
    const attached = await attachJobsForUser(
      userSupabase,
      catalogAdmin,
      userId,
      listings as JobListingRow[],
      profileSummary,
      matchingTemplate,
    );

    await userSupabase
      .from("job_monitors")
      .update({
        last_scraped_at: new Date().toISOString(),
        last_scrape_status: "success",
        last_scrape_error: null,
        last_jobs_found: scraped.length,
      })
      .eq("id", monitor.id)
      .eq("user_id", userId);

    return {
      ok: true,
      jobsFound: scraped.length,
      jobsAttached: attached.length,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await userSupabase
      .from("job_monitors")
      .update({
        last_scraped_at: new Date().toISOString(),
        last_scrape_status: "error",
        last_scrape_error: message.slice(0, 500),
      })
      .eq("id", monitor.id)
      .eq("user_id", userId);

    return { ok: false, jobsFound: 0, jobsAttached: 0, error: message };
  }
}

/** Monitors due for scheduled scrape (daily / weekly). */
export function isMonitorDueForScrape(
  monitor: JobMonitorRow,
  now = new Date(),
): boolean {
  if (!monitor.active || monitor.scrape_frequency === "manual") return false;

  const last = monitor.last_scraped_at ? new Date(monitor.last_scraped_at) : null;
  if (!last) return true;

  const hoursSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
  if (monitor.scrape_frequency === "daily") return hoursSince >= 23;
  if (monitor.scrape_frequency === "weekly") return hoursSince >= 24 * 6.5;
  return false;
}
