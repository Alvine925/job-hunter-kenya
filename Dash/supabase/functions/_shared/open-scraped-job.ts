import { analyzeScrapedJob } from "./job-enrichment.ts";
import { resolveApplicationEmailFromListing } from "./resolve-application-email.ts";
import { isLowQualityJobForAttach } from "./scrape-utils.ts";
import { todayIsoDate } from "./parse-deadline.ts";
import { resolveCompanyLogoUrl } from "./logo-utils.ts";
import { runJobMatchingAgent } from "./job-agents.ts";

async function getMatchingTemplate(supabase: any, userId: string) {
  const { data } = await supabase
    .from("templates")
    .select("content")
    .eq("user_id", userId)
    .eq("type", "job_matching")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.content ?? null;
}

export async function matchScrapedJobForUser(
  supabase: any,
  userId: string,
  scrapedJob: any,
) {
  const { data: dbJob } = await supabase
    .from("scraped_jobs")
    .select("match_score_cache")
    .eq("id", scrapedJob.id)
    .maybeSingle();
  const cache = dbJob?.match_score_cache || {};
  if (cache[userId] && typeof cache[userId].score === "number") {
    return { matchData: cache[userId], analysis: null };
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (!profile) throw new Error("Complete your profile first");

  const roles = profile.desired_roles?.length ? profile.desired_roles : ["jobs"];

  // Calculate quick keyword match score for cost control
  let preFilterScore = 0;
  const titleLower = (scrapedJob.title ?? "").toLowerCase();
  const descLower = (scrapedJob.description ?? "").toLowerCase();
  const reqLower = (scrapedJob.requirements ?? "").toLowerCase();
  const roleDescLower = (scrapedJob.role_description ?? "").toLowerCase();
  const fullTextLower = `${titleLower} ${descLower} ${reqLower} ${roleDescLower}`;

  // 1. Roles matching
  for (const role of roles) {
    const roleLower = role.toLowerCase().trim();
    if (titleLower.includes(roleLower)) {
      preFilterScore += 35;
    } else if (fullTextLower.includes(roleLower)) {
      preFilterScore += 20;
    }
  }

  // 2. Skills matching
  const skills = profile.skills ?? [];
  for (const skill of skills) {
    const skillLower = skill.toLowerCase().trim();
    if (titleLower.includes(skillLower)) {
      preFilterScore += 15;
    } else if (reqLower.includes(skillLower)) {
      preFilterScore += 10;
    } else if (descLower.includes(skillLower) || roleDescLower.includes(skillLower)) {
      preFilterScore += 5;
    }
  }

  // 3. Location matching
  if (profile.preferred_county && scrapedJob.county) {
    const pCounty = profile.preferred_county.toLowerCase().trim();
    const jCounty = scrapedJob.county.toLowerCase().trim();
    if (pCounty === jCounty || jCounty.includes(pCounty) || pCounty.includes(jCounty)) {
      preFilterScore += 15;
    }
  }

  if (preFilterScore < 30) {
    const matchData = {
      score: Math.max(preFilterScore, 10), // minimum 10
      reason: "Low keyword match with your desired roles and skills.",
      strengths: "",
      gaps: "Desired roles or key skills were not found in this job listing.",
      scored_at: new Date().toISOString(),
    };

    const newCache = { ...cache, [userId]: matchData };
    await supabase
      .from("scraped_jobs")
      .update({ match_score_cache: newCache })
      .eq("id", scrapedJob.id);

    return { matchData, analysis: null };
  }

  const profileSummary =
    `Skills: ${(profile.skills ?? []).join(", ")}. Roles wanted: ${roles.join(", ")}. Summary: ${profile.professional_summary ?? ""}. Experience: ${profile.work_history ?? ""}.`;

  const matchingTemplate = await getMatchingTemplate(supabase, userId);

  const analysis = await runJobMatchingAgent({
    profileSummary,
    job: {
      title: scrapedJob.title,
      source_url: scrapedJob.source_url,
      description: scrapedJob.description || scrapedJob.role_description || "",
    },
    template: matchingTemplate,
  });

  const matchData = {
    score: analysis.match_score ?? 50,
    reason: analysis.match_reason ?? "",
    strengths: analysis.match_strengths || "",
    gaps: analysis.match_gaps || "",
    scored_at: new Date().toISOString(),
  };

  const newCache = { ...cache, [userId]: matchData };
  await supabase
    .from("scraped_jobs")
    .update({ match_score_cache: newCache })
    .eq("id", scrapedJob.id);

  return { matchData, analysis };
}

export async function attachScrapedJobToUser(
  supabase: any,
  userId: string,
  scraped: any,
  matchData: any,
) {
  let { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("source_url", scraped.source_url)
    .maybeSingle();

  if (!job && scraped.title && scraped.company) {
    const { data: duplicateJob } = await supabase
      .from("jobs")
      .select("*")
      .eq("user_id", userId)
      .eq("title", scraped.title)
      .eq("company", scraped.company)
      .limit(1)
      .maybeSingle();

    if (duplicateJob) {
      job = duplicateJob;
    }
  }

  if (!job) {
    const record = {
      title: scraped.title,
      company: scraped.company,
      source_url: scraped.source_url,
      role_description: scraped.role_description,
      requirements: scraped.requirements,
      responsibilities: scraped.responsibilities,
    };
    if (isLowQualityJobForAttach(record)) {
      console.log("skip attaching low-quality job:", record.title, record.company);
      return null;
    }

    const { data: inserted, error: insErr } = await supabase
      .from("jobs")
      .insert({
        user_id: userId,
        title: scraped.title,
        company: scraped.company,
        logo_url: resolveCompanyLogoUrl(scraped.company ?? ""),
        company_summary: scraped.company_summary,
        role_description: scraped.role_description,
        location: scraped.location,
        county: scraped.county,
        description: scraped.description,
        requirements: scraped.requirements,
        responsibilities: scraped.responsibilities,
        salary_text: scraped.salary_text,
        job_type: scraped.job_type,
        source: scraped.source ?? scraped.site,
        source_url: scraped.source_url,
        application_email: scraped.application_email,
        application_url: scraped.application_url || scraped.source_url,
        application_method: scraped.application_email
          ? "email"
          : scraped.application_method === "form"
          ? "form"
          : scraped.application_method ?? "unknown",
        contact_person: scraped.contact_person,
        contact_phone: scraped.contact_phone,
        deadline: scraped.deadline,
        match_score: matchData.score,
        match_reason: matchData.reason,
        match_strengths: matchData.strengths,
        match_gaps: matchData.gaps,
        tracker_status: "new",
      })
      .select()
      .single();
    if (insErr) throw insErr;
    job = inserted;

    if (!job.application_email && job.source_url) {
      const resolved = await resolveApplicationEmailFromListing(job);
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
          .eq("id", job.id)
          .select()
          .single();
        if (updated) job = updated;
      }
    }
  }

  return job;
}

/** Open a marketplace listing: reuse existing user job by source_url or import + match. */
export async function getOrCreateJobFromScraped(
  supabase: any,
  userId: string,
  scrapedJobId: string,
) {
  const { data: scraped, error: scrapedErr } = await supabase
    .from("scraped_jobs")
    .select("*")
    .eq("id", scrapedJobId)
    .single();
  if (scrapedErr || !scraped) throw new Error("Marketplace job not found");

  const { matchData } = await matchScrapedJobForUser(supabase, userId, scraped);
  const job = await attachScrapedJobToUser(supabase, userId, scraped, matchData);
  if (!job) throw new Error("This listing is not a valid single job posting");

  const today = todayIsoDate();
  const { data: app } = await supabase
    .from("applications")
    .select("*")
    .eq("job_id", job.id)
    .eq("user_id", userId)
    .maybeSingle();

  const board = scraped.source ?? scraped.site;
  let similarQuery = supabase
    .from("scraped_jobs")
    .select("id, title, company, location, county, job_type, source, source_url")
    .neq("id", scrapedJobId)
    .order("scraped_at", { ascending: false })
    .limit(8);
  if (board) {
    similarQuery = similarQuery.or(`source.eq.${board},site.eq.${board}`);
  }
  const { data: similarRows } = await similarQuery;

  const { data: userMatches } = await supabase
    .from("jobs")
    .select("source_url, match_score")
    .eq("user_id", userId)
    .in("source_url", (similarRows ?? []).map((r: { source_url: string }) => r.source_url));

  const scoreByUrl = new Map(
    (userMatches ?? []).map((j: { source_url: string; match_score: number | null }) => [
      j.source_url,
      j.match_score,
    ]),
  );

  const similar_jobs = (similarRows ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    match_score: scoreByUrl.get(r.source_url as string) ?? null,
  }));

  return {
    job,
    application: app,
    similar_jobs,
    scraped_job_id: scrapedJobId,
  };
}
