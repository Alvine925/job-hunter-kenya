/** Site scraper — isolated from user jobs / job_listings flow. Writes to scraped_jobs only. */
import {
  authorizeRequest,
  corsHeaders,
  resolveScrapeJobLimit,
  scrapeSite,
} from "../_shared/job-scraper.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const unauthorized = authorizeRequest(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const limit = resolveScrapeJobLimit(Number(url.searchParams.get("limit") ?? 5));

  try {
    const result = await scrapeSite("fuzu", limit);
    return new Response(JSON.stringify({ ok: true, site: "fuzu", ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("scrape-fuzu failed", error);
    return new Response(
      JSON.stringify({
        ok: false,
        site: "fuzu",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
