import { analyzeScrapedJob } from "./job-enrichment.ts";
import { resolveApplicationEmailFromListing } from "./resolve-application-email.ts";
import { isLowQualityJobForAttach } from "./scrape-utils.ts";
import { todayIsoDate } from "./parse-deadline.ts";
import { resolveCompanyLogoUrl } from "./logo-utils.ts";

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

  let { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("source_url", scraped.source_url)
    .maybeSingle();

  if (!job) {
    // Check if we already have a job with the same title and company for this user to avoid duplicates
    if (scraped.title && scraped.company) {
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
  }

  if (!job) {
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (!profile) throw new Error("Complete your profile first");

    const roles = profile.desired_roles?.length ? profile.desired_roles : ["jobs"];
    const profileSummary =
      `Skills: ${(profile.skills ?? []).join(", ")}. Roles wanted: ${roles.join(", ")}. Summary: ${profile.professional_summary ?? ""}. Experience: ${profile.work_history ?? ""}.`;

    const analysis = await analyzeScrapedJob({
      profileSummary,
      job: {
        title: scraped.title,
        source_url: scraped.source_url,
        source: scraped.source ?? scraped.site ?? "Unknown",
        description: scraped.description ?? scraped.role_description,
        company: scraped.company,
        location: scraped.location,
      },
      matchingTemplate: await getMatchingTemplate(supabase, userId),
    });

    const record = {
      title: scraped.title,
      company: analysis.company ?? scraped.company,
      source_url: scraped.source_url,
      role_description: analysis.role_description ?? scraped.role_description,
      requirements: analysis.requirements ?? scraped.requirements,
      responsibilities: analysis.responsibilities ?? scraped.responsibilities,
    };
    if (isLowQualityJobForAttach(record)) {
      throw new Error("This listing is not a valid single job posting");
    }

    const { data: inserted, error: insErr } = await supabase
      .from("jobs")
      .insert({
        user_id: userId,
        title: scraped.title,
        company: analysis.company ?? scraped.company,
        logo_url: resolveCompanyLogoUrl(analysis.company ?? scraped.company ?? ""),
        company_summary: analysis.company_summary ?? scraped.company_summary,
        role_description: analysis.role_description ?? scraped.role_description,
        location: analysis.location ?? scraped.location,
        county: analysis.county ?? scraped.county,
        description: scraped.description ?? analysis.description,
        requirements: analysis.requirements ?? scraped.requirements,
        responsibilities: analysis.responsibilities ?? scraped.responsibilities,
        salary_text: analysis.salary_text ?? scraped.salary_text,
        job_type: analysis.job_type ?? scraped.job_type,
        source: scraped.source ?? scraped.site,
        source_url: scraped.source_url,
        application_email: analysis.application_email ?? scraped.application_email,
        application_url:
          analysis.application_url || scraped.application_url || scraped.source_url,
        application_method: analysis.application_email
          ? "email"
          : analysis.application_method === "form"
          ? "form"
          : scraped.application_method ?? "unknown",
        contact_person: scraped.contact_person,
        contact_phone: scraped.contact_phone,
        deadline: scraped.deadline,
        match_score: analysis.match_score ?? 50,
        match_reason: analysis.match_reason ?? null,
        match_strengths: analysis.match_strengths ?? null,
        match_gaps: analysis.match_gaps ?? null,
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
