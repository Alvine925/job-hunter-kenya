import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, createAdminClient } from "../_shared/supabase.ts";
import { prepareOrApplyJob } from "../_shared/application-engine.ts";
import { resolveGoogleAccessToken } from "../_shared/google-auth.ts";
import {
  attachJobsForUser,
  discoverJobListings,
} from "../_shared/job-catalog.ts";
import { DEFAULT_JOB_SOURCES } from "../_shared/job-sources.ts";
import { isLowQualityJob } from "../_shared/scrape-utils.ts";
import { todayIsoDate } from "../_shared/parse-deadline.ts";
import { getOrCreateJobFromScraped } from "../_shared/open-scraped-job.ts";
import { resolveApplicationEmailFromListing } from "../_shared/resolve-application-email.ts";
import { scrapeUrlMarkdown } from "../_shared/firecrawl.ts";
import { coachGreeting, loadCoachMessages, runJobCoachTurn } from "../_shared/job-coach.ts";
import {
  generateInterviewReport,
  loadInterviewQuizState,
  resetInterviewQuiz,
  startInterviewQuiz,
  submitInterviewAnswer,
} from "../_shared/interview-quiz.ts";
import { summarizeApplicationForJobList } from "../_shared/application-engine.ts";

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
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await requireAuth(req);
    const body = await req.json();
    const action = body.action;
    const today = todayIsoDate();

    // ---- LIST ----
    if (action === "list") {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("user_id", userId)
        .or(`deadline.is.null,deadline.gte.${today}`)
        .order("match_score", { ascending: false })
        .limit(200);
      if (error) throw error;
      const filtered = (data ?? []).filter((j: Record<string, unknown>) => !isLowQualityJob({
        title: j.title as string,
        company: j.company as string,
        source_url: j.source_url as string,
        role_description: j.role_description as string,
        requirements: j.requirements as string,
        responsibilities: j.responsibilities as string,
      }));

      const { data: applications } = await supabase
        .from("applications")
        .select(
          "job_id, status, cover_letter, pack_questions, interview_questions, email_body, email_subject, prepared_at, drive_url",
        )
        .eq("user_id", userId);

      const appByJob = new Map(
        (applications ?? []).map((a: { job_id: string }) => [a.job_id, a]),
      );

      const jobs = filtered.map((j: Record<string, unknown>) => {
        const app = appByJob.get(j.id as string) as Record<string, unknown> | undefined;
        return {
          ...j,
          application_status: summarizeApplicationForJobList(app ?? null),
        };
      });

      return new Response(JSON.stringify({ jobs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- GET ----
    if (action === "get") {
      const { id } = body;
      if (!id) throw new Error("Missing job id");
      const { data: job, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();
      if (error) throw error;

      let jobOut = job;
      if (!job.application_email && (job.source_url || job.application_url)) {
        // Fast path for job detail page — avoid Firecrawl on every load (was blocking UI 30s+).
        const resolved = await resolveApplicationEmailFromListing(job, scrapeUrlMarkdown, {
          allowDeepScrape: false,
        });
        if (resolved.application_email) {
          const patch: Record<string, unknown> = {
            application_email: resolved.application_email,
            application_method: "email",
          };
          if (
            resolved.description &&
            resolved.description.length > (job.description?.length ?? 0)
          ) {
            patch.description = resolved.description;
          }
          const { data: updated } = await supabase
            .from("jobs")
            .update(patch)
            .eq("id", id)
            .eq("user_id", userId)
            .select()
            .single();
          if (updated) jobOut = updated;
        }
      }

      const { data: app } = await supabase
        .from("applications")
        .select("*")
        .eq("job_id", id)
        .eq("user_id", userId)
        .maybeSingle();

      // Build a similarity OR: prefer same job_type / county, but also surface
      // any job the AI scored ≥ 60 so partial matches (e.g. related roles) show up.
      const simParts: string[] = ["match_score.gte.60"];
      if (jobOut.job_type) simParts.push(`job_type.eq.${jobOut.job_type}`);
      if (jobOut.county)   simParts.push(`county.eq.${jobOut.county}`);

      const { data: similar_jobs } = await supabase
        .from("jobs")
        .select("id, title, company, location, county, match_score, job_type, source, source_url")
        .eq("user_id", userId)
        .neq("id", id)
        .gte("match_score", 35)
        .or(`deadline.is.null,deadline.gte.${today}`)
        .or(simParts.join(","))
        .order("match_score", { ascending: false })
        .limit(8);

      return new Response(
        JSON.stringify({ job: jobOut, application: app, similar_jobs: similar_jobs ?? [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- JOB COACH (saved chat + similar jobs) ----
    if (action === "job-coach-load") {
      const { jobId } = body;
      if (!jobId) throw new Error("Missing jobId");

      const [{ data: job }, { data: profile }] = await Promise.all([
        supabase.from("jobs").select("title").eq("id", jobId).eq("user_id", userId).single(),
        supabase.from("profiles").select("full_name").eq("id", userId).single(),
      ]);
      if (!job) throw new Error("Job not found");

      const messages = await loadCoachMessages(supabase, userId, jobId);
      const first = (profile?.full_name ?? "").split(/\s+/)[0] || "there";

      return new Response(
        JSON.stringify({
          messages,
          greeting: coachGreeting(first, job.title ?? ""),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "job-coach-chat") {
      const { jobId, userMessage, messages } = body as {
        jobId?: string;
        userMessage?: string;
        messages?: { role: string; content: string }[];
      };
      if (!jobId) throw new Error("Missing jobId");
      if (!userMessage?.trim()) throw new Error("Missing message");

      // Check limits first! (FIX 15)
      const { data: limitCheck, error: limitErr } = await supabase.rpc("check_user_limits", {
        p_user_id: userId,
        p_action_type: "job_coach_chat",
      });

      if (limitErr) {
        console.error("Limit check error:", limitErr);
      } else if (limitCheck && !limitCheck.allowed) {
        return new Response(JSON.stringify({ error: limitCheck.reason }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const transcript = Array.isArray(messages) ? messages : [];
      const result = await runJobCoachTurn({
        supabase,
        userId,
        jobId,
        userMessage: userMessage.trim(),
        transcript,
      });

      // Track usage (FIX 15)
      await supabase.rpc("track_user_usage", {
        p_user_id: userId,
        p_action_type: "job_coach_chat",
        p_metadata: { jobId },
      });

      return new Response(
        JSON.stringify({
          message: result.message,
          similar_jobs: result.similar_jobs,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "interview-coach-load" || action === "interview-load") {
      const { jobId } = body;
      if (!jobId) throw new Error("Missing jobId");
      const state = await loadInterviewQuizState(supabase, userId, jobId);
      return new Response(JSON.stringify(state), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "interview-start") {
      const { jobId, mode } = body as { jobId?: string; mode?: string };
      if (!jobId) throw new Error("Missing jobId");
      if (mode !== "chat" && mode !== "voice") throw new Error("mode must be chat or voice");
      const result = await startInterviewQuiz({ supabase, userId, jobId, mode });
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "interview-submit-answer") {
      const { jobId, answer } = body as { jobId?: string; answer?: string };
      if (!jobId) throw new Error("Missing jobId");

      // Check limits first! (FIX 15)
      const { data: limitCheck, error: limitErr } = await supabase.rpc("check_user_limits", {
        p_user_id: userId,
        p_action_type: "interview_answer",
      });

      if (limitErr) {
        console.error("Limit check error:", limitErr);
      } else if (limitCheck && !limitCheck.allowed) {
        return new Response(JSON.stringify({ error: limitCheck.reason }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await submitInterviewAnswer({
        supabase,
        userId,
        jobId,
        answer: answer ?? "",
      });

      // Track usage (FIX 15)
      await supabase.rpc("track_user_usage", {
        p_user_id: userId,
        p_action_type: "interview_answer",
        p_metadata: { jobId },
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "interview-generate-report") {
      const { jobId } = body;
      if (!jobId) throw new Error("Missing jobId");
      const result = await generateInterviewReport({ supabase, userId, jobId });
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "interview-reset") {
      const { jobId } = body;
      if (!jobId) throw new Error("Missing jobId");
      await resetInterviewQuiz(supabase, userId, jobId);
      const state = await loadInterviewQuizState(supabase, userId, jobId);
      return new Response(JSON.stringify(state), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- MARKETPLACE (scraped_jobs → user job + match, same detail UX) ----
    if (action === "get-scraped") {
      const { scrapedJobId } = body;
      if (!scrapedJobId) throw new Error("Missing scraped job id");
      const payload = await getOrCreateJobFromScraped(supabase, userId, scrapedJobId);
      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- SCRAPE ----
    if (action === "scrape") {
      // Check limits first! (FIX 15)
      const { data: limitCheck, error: limitErr } = await supabase.rpc("check_user_limits", {
        p_user_id: userId,
        p_action_type: "job_scrape",
      });

      if (limitErr) {
        console.error("Limit check error:", limitErr);
      } else if (limitCheck && !limitCheck.allowed) {
        return new Response(JSON.stringify({ error: limitCheck.reason }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const limit = Math.min(Math.max(body.limit ?? 20, 1), 50);
      const admin = createAdminClient();
      const [{ data: profile }, workflowRes, { data: integration }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase
          .from("workflows")
          .select("*")
          .eq("user_id", userId)
          .eq("active", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase.from("user_integrations").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      let workflow = workflowRes.data;
      if (!workflow) {
        const fallback = await supabase
          .from("workflows")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        workflow = fallback.data;
      }
      if (!profile) throw new Error("Complete your profile first");

      const roles = workflow?.target_roles?.length
        ? workflow.target_roles
        : profile.desired_roles?.length
        ? profile.desired_roles
        : ["jobs"];
      const counties = workflow?.target_counties?.length
        ? workflow.target_counties
        : profile.preferred_county
        ? [profile.preferred_county]
        : ["Kenya"];
      const rawSources = workflow?.sources?.length ? workflow.sources : DEFAULT_JOB_SOURCES;
      const sources = rawSources.filter((s: string) => s !== "LinkedIn").length
        ? rawSources.filter((s: string) => s !== "LinkedIn")
        : DEFAULT_JOB_SOURCES;
      const linkedInEnabled = rawSources.includes("LinkedIn");
      const minMatchScore = workflow?.min_match_score ?? 70;
      const maxApplications = Math.min(workflow?.max_applications ?? 10, limit);
      const mode = (workflow?.application_mode ?? (workflow?.auto_apply ? "automatic" : "manual")) === "automatic"
        ? "automatic"
        : "manual";

      let googleAccessToken: string | null = null;
      try {
        googleAccessToken = await resolveGoogleAccessToken(supabase, userId);
      } catch {
        googleAccessToken = integration?.google_access_token ?? null;
      }

      const linkedinLiAt =
        integration?.linkedin_li_at?.trim() || Deno.env.get("LINKEDIN_LI_AT")?.trim() || null;
      const linkedinTimeFilter = integration?.linkedin_time_filter ?? "r86400";

      const discovery = await discoverJobListings(admin, {
        roles,
        counties,
        sources: linkedInEnabled ? [...sources, "LinkedIn"] : sources,
        limit,
        linkedinLiAt: linkedInEnabled ? linkedinLiAt : null,
        linkedinTimeFilter: linkedInEnabled ? linkedinTimeFilter : null,
      });

      if (discovery.listings.length === 0) {
        return new Response(
          JSON.stringify({
            count: 0,
            jobs: [],
            fromCache: discovery.fromCache,
            fromScrape: discovery.fromScrape,
            skippedExpired: discovery.skippedExpired,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const profileSummary = `Skills: ${(profile.skills ?? []).join(", ")}. Roles wanted: ${roles.join(", ")}. Summary: ${profile.professional_summary ?? ""}. Experience: ${profile.work_history ?? ""}.`;
      const matchingTemplate = await getTemplate(supabase, userId, "job_matching");

      const attached = await attachJobsForUser(
        supabase,
        admin,
        userId,
        discovery.listings,
        profileSummary,
        matchingTemplate,
      );

      const inserted = attached.map((a) => a.job);
      const candidates = inserted
        .filter((job: any) => (job.match_score ?? 0) >= minMatchScore)
        .slice(0, maxApplications);
      const outcomes = [];

      for (const job of candidates) {
        try {
          outcomes.push(await prepareOrApplyJob({
            supabase,
            userId,
            job,
            profile,
            mode,
            tone: workflow?.cover_letter_tone ?? "Formal",
            googleAccessToken,
          }));
        } catch (e) {
          console.error("application workflow failed", job.id, e);
          outcomes.push({
            action: "failed",
            jobId: job.id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // Track usage (FIX 15)
      await supabase.rpc("track_user_usage", {
        p_user_id: userId,
        p_action_type: "job_scrape",
        p_metadata: { limit },
      });

      return new Response(
        JSON.stringify({
          count: inserted.length,
          jobs: inserted,
          mode,
          fromCache: discovery.fromCache,
          fromScrape: discovery.fromScrape,
          skippedExpired: discovery.skippedExpired,
          prepared: outcomes.filter((o: any) => o.action === "drafted" || o.action === "packed").length,
          sent: outcomes.filter((o: any) => o.action === "sent").length,
          skipped: outcomes.filter((o: any) => o.action === "skipped_existing_application").length,
          needsAuth: outcomes.filter((o: any) => o.action === "auth_required").length,
          outcomes,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    console.error("Jobs edge function error:", err);
    // Sanitize error messages (FIX 16)
    const isUserFriendly =
      rawMessage.includes("Missing") ||
      rawMessage.includes("not found") ||
      rawMessage.includes("limit") ||
      rawMessage.includes("Complete your profile first") ||
      rawMessage.includes("Unauthorized") ||
      rawMessage.includes("Invalid");
    const displayMessage = isUserFriendly ? rawMessage : "An unexpected server error occurred.";
    return new Response(JSON.stringify({ error: displayMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
