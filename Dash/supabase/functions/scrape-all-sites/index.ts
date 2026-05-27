import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  authorizeRequest,
  corsHeaders,
  scrapeSite,
  type SiteId,
} from "../_shared/job-scraper.ts";
import { createAdminClient } from "../_shared/supabase.ts";

/**
 * Runs all 5 board scrapers → public.scraped_jobs (ScrapingBee + AI).
 * POST /functions/v1/scrape-all-sites?limit=3
 *
 * Auth: Bearer <service_role JWT> + header apikey (same JWT)
 * Not valid: sb_publishable_* keys (Supabase gateway rejects them)
 */

const ALL_SITES: SiteId[] = [
  "fuzu",
  "brightermonday",
  "myjobmag",
  "myjobsinkenya",
  "linkedin",
];

async function countScrapedJobs(): Promise<number> {
  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("scraped_jobs")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return count ?? 0;
  } catch (e) {
    console.error("count scraped_jobs:", e);
    return 0;
  }
}

async function parseBody(req: Request): Promise<{ limit?: number; sites?: SiteId[] }> {
  try {
    const text = await req.text();
    if (!text.trim()) return {};
    return JSON.parse(text) as { limit?: number; sites?: SiteId[] };
  } catch {
    return {};
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        name: "scrape-all-sites",
        scrapers: ALL_SITES,
        requiredSecrets: ["SCRAPINGBEE_API_KEY", "SERPAPI_API_KEY (fallback)", "LINKEDIN_LI_AT (optional)"],
        auth:
          "Headers: Authorization Bearer <service_role JWT> and apikey <same JWT>. Do not use sb_publishable_* keys.",
        exampleBody: { limit: 3 },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const unauthorized = authorizeRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const hasBee = !!Deno.env.get("SCRAPINGBEE_API_KEY")?.trim();
    const hasSerp = !!(Deno.env.get("SERPAPI_API_KEY") ?? Deno.env.get("SERPAPI_KEY"))?.trim();
    if (!hasBee && !hasSerp) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Set SCRAPINGBEE_API_KEY and/or SERPAPI_API_KEY in Edge Function secrets",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    const body = await parseBody(req);
    let limit = Number(body.limit ?? url.searchParams.get("limit") ?? 3);
    limit = Math.min(15, Math.max(1, limit));

    const sites = body.sites?.length
      ? ALL_SITES.filter((s) => body.sites!.includes(s))
      : ALL_SITES;

    const jobsBefore = await countScrapedJobs();
    const results: Record<string, unknown>[] = [];

    for (const site of sites) {
      if (site === "linkedin" && !Deno.env.get("LINKEDIN_LI_AT")?.trim()) {
        results.push({ site, skipped: true, reason: "LINKEDIN_LI_AT not set" });
        continue;
      }
      try {
        console.log(`Scraping ${site} (limit=${limit})…`);
        results.push(await scrapeSite(site, limit));
      } catch (e) {
        console.error(`scrape ${site} failed:`, e);
        results.push({
          site,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const jobsAfter = await countScrapedJobs();
    const totalScraped = results.reduce(
      (n, r) => n + (typeof r.scraped === "number" ? r.scraped : 0),
      0,
    );

    return new Response(
      JSON.stringify({
        ok: totalScraped > 0 || results.every((r) => r.skipped),
        limitPerBoard: limit,
        totalScrapedThisRun: totalScraped,
        scrapedJobsInDb: { before: jobsBefore, after: jobsAfter, added: jobsAfter - jobsBefore },
        results,
        ranAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("scrape-all-sites fatal:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
