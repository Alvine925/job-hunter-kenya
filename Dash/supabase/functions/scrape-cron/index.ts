// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { errorResponse } from "../_shared/error-sanitizer.ts";
import { prepareOrApplyJob } from "../_shared/application-engine.ts";
import { refreshGoogleAccessToken } from "../_shared/google-auth.ts";
import {
  attachJobsForUser,
  discoverJobListings,
} from "../_shared/job-catalog.ts";
import { DEFAULT_JOB_SOURCES } from "../_shared/job-sources.ts";
import {
  isMonitorDueForScrape,
  scrapeJobMonitor,
  type JobMonitorRow,
} from "../_shared/scrape-monitors.ts";
import {
  matchScrapedJobForUser,
  attachScrapedJobToUser,
} from "../_shared/open-scraped-job.ts";

async function getTemplate(supabase: any, userId: string, type: string) {
  const { data } = await supabase
    .from("templates")
    .select("content")
    .eq("user_id", userId)
    .eq("type", type)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.content ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      throw new Error("Unauthorized");
    }

    const supabaseAdmin = createAdminClient();
    const { data: workflows } = await supabaseAdmin
      .from("workflows")
      .select("*")
      .eq("active", true);

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: freshScrapedJobs } = await supabaseAdmin
      .from("scraped_jobs")
      .select("*")
      .gte("scraped_at", twentyFourHoursAgo);

    let total = 0;
    let drafted = 0;
    let sent = 0;
    let packed = 0;
    let authRequired = 0;
    let skipped = 0;
    let fromCache = 0;
    let fromScrape = 0;
    let skippedExpired = 0;

    for (const workflow of workflows ?? []) {
      try {
        const [{ data: profile }, { data: integration }] = await Promise.all([
          supabaseAdmin.from("profiles").select("*").eq("id", workflow.user_id).single(),
          supabaseAdmin.from("user_integrations").select("*").eq("user_id", workflow.user_id).maybeSingle(),
        ]);
        if (!profile) continue;

        let googleAccessToken = integration?.google_access_token ?? null;
        if (integration?.google_refresh_token) {
          const refreshed = await refreshGoogleAccessToken(integration.google_refresh_token);
          if (refreshed) {
            googleAccessToken = refreshed;
            await supabaseAdmin
              .from("user_integrations")
              .update({ google_access_token: refreshed, google_connected: true })
              .eq("user_id", workflow.user_id);
          }
        }

        const roles = workflow.target_roles?.length
          ? workflow.target_roles
          : profile.desired_roles?.length
          ? profile.desired_roles
          : null;
        if (!roles) continue;

        const counties = workflow.target_counties?.length
          ? workflow.target_counties
          : profile.preferred_county
          ? [profile.preferred_county]
          : ["Kenya"];

        const sources = workflow.sources?.length ? workflow.sources : DEFAULT_JOB_SOURCES;
        const limit = workflow.max_applications ?? 15;

        const linkedInEnabled = sources.includes("LinkedIn");
        const linkedinLiAt =
          integration?.linkedin_li_at?.trim() || Deno.env.get("LINKEDIN_LI_AT")?.trim() || null;
        const linkedinTimeFilter = integration?.linkedin_time_filter ?? "r86400";

        const discovery = await discoverJobListings(supabaseAdmin, {
          roles,
          counties,
          sources,
          limit,
          linkedinLiAt: linkedInEnabled ? linkedinLiAt : null,
          linkedinTimeFilter: linkedInEnabled ? linkedinTimeFilter : null,
        });
        fromCache += discovery.fromCache;
        fromScrape += discovery.fromScrape;
        skippedExpired += discovery.skippedExpired;

        const profileSummary = `Skills: ${(profile.skills ?? []).join(", ")}. Roles: ${roles.join(", ")}. Summary: ${profile.professional_summary ?? ""}.`;
        const matchingTemplate = await getTemplate(supabaseAdmin, profile.id, "job_matching");

        const attached = await attachJobsForUser(
          supabaseAdmin,
          supabaseAdmin,
          profile.id,
          discovery.listings,
          profileSummary,
          matchingTemplate,
        );

        for (const { job: inserted } of attached) {
          if (!inserted) continue;
          total++;

          if ((inserted.match_score ?? 0) >= (workflow.min_match_score ?? 70)) {
            const isUpgraded = profile.current_plan === "upgraded";
            const mode = (workflow.application_mode === "automatic" || workflow.auto_apply) && isUpgraded
              ? "automatic"
              : "manual";
            const outcome = await prepareOrApplyJob({
              supabase: supabaseAdmin,
              userId: profile.id,
              job: inserted,
              profile,
              mode,
              tone: workflow.cover_letter_tone ?? "Formal",
              googleAccessToken,
            });
            if (outcome.action === "sent") sent++;
            if (outcome.action === "drafted") drafted++;
            if (outcome.action === "packed") packed++;
            if (outcome.action === "auth_required") authRequired++;
            if (outcome.action === "skipped_existing_application") skipped++;
          }
        }

        // Process background matching of fresh scraped jobs
        if (freshScrapedJobs && freshScrapedJobs.length > 0) {
          for (const scrapedJob of freshScrapedJobs) {
            try {
              const { matchData } = await matchScrapedJobForUser(
                supabaseAdmin,
                workflow.user_id,
                scrapedJob,
              );
              
              const scoreThreshold = workflow.min_match_score ?? 80;
              if (matchData && matchData.score >= scoreThreshold) {
                const inserted = await attachScrapedJobToUser(
                  supabaseAdmin,
                  workflow.user_id,
                  scrapedJob,
                  matchData,
                );
                
                if (inserted) {
                  total++;
                  const isUpgraded = profile.current_plan === "upgraded";
                  const mode = (workflow.application_mode === "automatic" || workflow.auto_apply) && isUpgraded
                    ? "automatic"
                    : "manual";
                  const outcome = await prepareOrApplyJob({
                    supabase: supabaseAdmin,
                    userId: profile.id,
                    job: inserted,
                    profile,
                    mode,
                    tone: workflow.cover_letter_tone ?? "Formal",
                    googleAccessToken,
                  });
                  if (outcome.action === "sent") sent++;
                  if (outcome.action === "drafted") drafted++;
                  if (outcome.action === "packed") packed++;
                  if (outcome.action === "auth_required") authRequired++;
                  if (outcome.action === "skipped_existing_application") skipped++;
                }
              }
            } catch (err) {
              console.error(`Failed background match for job ${scrapedJob.id}:`, err);
            }
          }
        }
      } catch (e) {
        console.error("profile scrape fail", workflow.user_id, e);
      }
    }

    let monitorsScraped = 0;
    let monitorsErrors = 0;
    const { data: dueMonitors } = await supabaseAdmin
      .from("job_monitors")
      .select("*")
      .eq("active", true)
      .neq("scrape_frequency", "manual");

    for (const monitor of dueMonitors ?? []) {
      if (!isMonitorDueForScrape(monitor as JobMonitorRow)) continue;
      try {
        const { data: workflow } = await supabaseAdmin
          .from("workflows")
          .select("*")
          .eq("user_id", monitor.user_id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("id", monitor.user_id)
          .single();
        if (!profile) continue;
        const roles = workflow?.target_roles?.length
          ? workflow.target_roles
          : profile.desired_roles ?? ["jobs"];
        const profileSummary = `Skills: ${(profile.skills ?? []).join(", ")}. Roles: ${roles.join(", ")}. Summary: ${profile.professional_summary ?? ""}.`;
        const matchingTemplate = await getTemplate(supabaseAdmin, monitor.user_id, "job_matching");
        const result = await scrapeJobMonitor({
          catalogAdmin: supabaseAdmin,
          userSupabase: supabaseAdmin,
          userId: monitor.user_id,
          monitor: monitor as JobMonitorRow,
          profileSummary,
          matchingTemplate,
        });
        if (result.ok) monitorsScraped++;
        else monitorsErrors++;
      } catch {
        monitorsErrors++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        inserted: total,
        drafted,
        sent,
        packed,
        authRequired,
        skipped,
        fromCache,
        fromScrape,
        skippedExpired,
        monitorsScraped,
        monitorsErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return errorResponse(err, "ScrapeCron", corsHeaders);
  }
});
