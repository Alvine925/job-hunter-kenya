import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { searchKenyaJobs } from "./firecrawl.server";
import { aiJson, aiText } from "./ai.server";
import { findOrCreateFolder, uploadTextFile } from "./drive.server";

// ---- Scrape and persist matched jobs ----
export const scrapeJobsForMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().min(1).max(50).default(20) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (!profile) throw new Error("Complete your profile first");

    const roles = profile.desired_roles?.length ? profile.desired_roles : ["jobs"];
    const counties = profile.preferred_county ? [profile.preferred_county] : ["Kenya"];

    const scraped = await searchKenyaJobs(roles, counties, data.limit);
    if (scraped.length === 0) return { count: 0, jobs: [] };

    // Deduplicate by source_url against existing
    const urls = scraped.map((s) => s.source_url);
    const { data: existing } = await supabase
      .from("jobs").select("source_url").eq("user_id", userId).in("source_url", urls);
    const have = new Set((existing ?? []).map((e: any) => e.source_url));
    const fresh = scraped.filter((s) => !have.has(s.source_url));

    // Score + reason via AI in batches
    const profileSummary = `Skills: ${(profile.skills ?? []).join(", ")}. Roles wanted: ${roles.join(", ")}. Summary: ${profile.professional_summary ?? ""}. Experience: ${profile.work_history ?? ""}.`;

    const enriched = await Promise.all(
      fresh.map(async (job) => {
        try {
          const analysis = await aiJson<{
            match_score: number; match_reason: string; match_strengths: string; match_gaps: string;
            requirements?: string; responsibilities?: string; salary_text?: string; job_type?: string;
            company?: string; location?: string; county?: string;
            application_email?: string; contact_person?: string; contact_phone?: string;
          }>(
            `Analyze this job listing for the candidate.\n\nCANDIDATE: ${profileSummary}\n\nJOB TITLE: ${job.title}\nJOB SOURCE: ${job.source_url}\nJOB CONTENT:\n${(job.description ?? "").slice(0, 6000)}\n\nReturn JSON with keys: match_score (0-100 integer), match_reason (2-3 sentences explaining why it matches or doesn't), match_strengths (bullet list as string), match_gaps (bullet list as string), requirements (string), responsibilities (string), salary_text (string or empty), job_type (Full-time/Part-time/Contract/Internship), company (string), location (string), county (Kenyan county or empty), application_email (string or empty), contact_person (string or empty), contact_phone (string or empty).`,
            "You are a job-matching analyst for the Kenyan job market. Be concise, factual. Output strict JSON only."
          );
          return { job, analysis };
        } catch (e) {
          return { job, analysis: { match_score: 50, match_reason: "Could not analyze.", match_strengths: "", match_gaps: "" } as any };
        }
      })
    );

    const rows = enriched.map(({ job, analysis }) => ({
      user_id: userId,
      title: job.title,
      company: analysis.company ?? job.company,
      location: analysis.location ?? job.location,
      county: analysis.county ?? null,
      description: job.description,
      requirements: analysis.requirements ?? null,
      responsibilities: analysis.responsibilities ?? null,
      salary_text: analysis.salary_text ?? null,
      job_type: analysis.job_type ?? null,
      source: job.source,
      source_url: job.source_url,
      application_email: analysis.application_email ?? null,
      contact_person: analysis.contact_person ?? null,
      contact_phone: analysis.contact_phone ?? null,
      match_score: analysis.match_score ?? 50,
      match_reason: analysis.match_reason ?? null,
      match_strengths: analysis.match_strengths ?? null,
      match_gaps: analysis.match_gaps ?? null,
      tracker_status: "new",
    }));

    if (rows.length === 0) return { count: 0, jobs: [] };
    const { data: inserted, error } = await supabase.from("jobs").insert(rows).select();
    if (error) throw error;
    return { count: inserted?.length ?? 0, jobs: inserted };
  });

// ---- List jobs ----
export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("jobs").select("*").eq("user_id", userId)
      .order("match_score", { ascending: false }).limit(200);
    if (error) throw error;
    return { jobs: data ?? [] };
  });

// ---- Get one job ----
export const getJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job, error } = await supabase.from("jobs").select("*").eq("id", data.id).eq("user_id", userId).single();
    if (error) throw error;
    const { data: app } = await supabase.from("applications").select("*").eq("job_id", data.id).eq("user_id", userId).maybeSingle();
    return { job, application: app };
  });

// ---- Generate cover letter + email and upload to Drive ----
export const generateAndSaveLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ jobId: z.string().uuid(), tone: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: job }, { data: profile }] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", data.jobId).eq("user_id", userId).single(),
      supabase.from("profiles").select("*").eq("id", userId).single(),
    ]);
    if (!job || !profile) throw new Error("Missing job or profile");

    const tone = data.tone ?? "Formal";
    const out = await aiJson<{ cover_letter: string; email_subject: string; email_body: string }>(
      `Write a tailored cover letter, email subject, and short email body for the candidate to apply to this job.\n\nCANDIDATE NAME: ${profile.full_name ?? ""}\nEMAIL: ${profile.email ?? ""}\nPHONE: ${profile.phone ?? ""}\nSKILLS: ${(profile.skills ?? []).join(", ")}\nSUMMARY: ${profile.professional_summary ?? ""}\nEXPERIENCE: ${profile.work_history ?? ""}\nEDUCATION: ${profile.education ?? ""}\n\nJOB: ${job.title} at ${job.company ?? ""} (${job.location ?? ""})\nDESCRIPTION: ${(job.description ?? "").slice(0, 4000)}\nREQUIREMENTS: ${job.requirements ?? ""}\n\nTone: ${tone}. Output JSON with keys cover_letter (full letter, ~350 words, no placeholders), email_subject (concise), email_body (4-6 sentences referencing CV attachment).`,
      "You are an expert career coach writing Kenyan job applications. Output strict JSON."
    );

    // Upload to Drive
    let driveFileId: string | null = null;
    let driveUrl: string | null = null;
    let folderId: string | null = null;
    try {
      const root = await findOrCreateFolder("JobHunter KE");
      folderId = await findOrCreateFolder(`${job.company ?? "Company"} - ${job.title}`.slice(0, 120), root);
      const fileName = `Cover Letter - ${job.title} - ${new Date().toISOString().slice(0, 10)}.txt`;
      const content = `${out.cover_letter}\n\n---\nEMAIL SUBJECT: ${out.email_subject}\n\nEMAIL BODY:\n${out.email_body}\n\n---\nJob: ${job.title}\nCompany: ${job.company ?? ""}\nSource: ${job.source_url ?? ""}`;
      const uploaded = await uploadTextFile(fileName, content, folderId);
      driveFileId = uploaded.id;
      driveUrl = uploaded.webViewLink;
    } catch (e) {
      console.error("Drive upload failed:", e);
    }

    // Upsert application
    const { data: existing } = await supabase.from("applications").select("id").eq("user_id", userId).eq("job_id", data.jobId).maybeSingle();
    const row = {
      user_id: userId,
      job_id: data.jobId,
      job_title: job.title,
      company: job.company,
      cover_letter: out.cover_letter,
      email_subject: out.email_subject,
      email_body: out.email_body,
      match_score: job.match_score,
      status: "draft" as const,
      drive_file_id: driveFileId,
      drive_url: driveUrl,
      drive_folder_id: folderId,
    };
    if (existing) {
      const { data: upd, error } = await supabase.from("applications").update(row).eq("id", existing.id).select().single();
      if (error) throw error;
      return { application: upd };
    } else {
      const { data: ins, error } = await supabase.from("applications").insert(row).select().single();
      if (error) throw error;
      return { application: ins };
    }
  });

// ---- Profile ----
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error) throw error;
    return { profile: data };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    full_name: z.string().optional(),
    phone: z.string().optional(),
    skills: z.array(z.string()).optional(),
    professional_summary: z.string().optional(),
    work_history: z.string().optional(),
    education: z.string().optional(),
    desired_roles: z.array(z.string()).optional(),
    preferred_county: z.string().optional(),
    linkedin_url: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: upd, error } = await supabase.from("profiles").update(data).eq("id", userId).select().single();
    if (error) throw error;
    return { profile: upd };
  });
