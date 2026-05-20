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
    email: z.string().optional(),
    skills: z.array(z.string()).optional(),
    professional_summary: z.string().optional(),
    work_history: z.string().optional(),
    education: z.string().optional(),
    desired_roles: z.array(z.string()).optional(),
    preferred_county: z.string().optional(),
    linkedin_url: z.string().optional(),
    certifications: z.string().optional(),
    languages: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: upd, error } = await supabase.from("profiles").update(data).eq("id", userId).select().single();
    if (error) throw error;
    return { profile: upd };
  });

// ---- CV upload + AI extraction ----
export const saveCvAndExtract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    storage_path: z.string().min(1),
    file_name: z.string().min(1),
    cv_text: z.string().min(20).max(60000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // public URL (bucket is private; sign URL for later display)
    const { data: signed } = await supabase.storage.from("cvs").createSignedUrl(data.storage_path, 60 * 60 * 24 * 7);

    const extracted = await aiJson<{
      full_name?: string; email?: string; phone?: string; linkedin_url?: string;
      preferred_county?: string; skills?: string[]; desired_roles?: string[];
      professional_summary?: string; work_history?: string; education?: string;
      certifications?: string; languages?: string;
    }>(
      `Extract structured profile data from this CV/resume text.\n\nCV TEXT:\n${data.cv_text.slice(0, 30000)}\n\nReturn JSON with keys: full_name, email, phone, linkedin_url, preferred_county (Kenyan county if mentioned), skills (array of strings), desired_roles (array of probable target roles based on experience), professional_summary (2-3 sentence summary), work_history (multi-line string of roles), education (multi-line string), certifications (string), languages (string). Use empty values if unknown.`,
      "You are a CV parser. Return strict JSON only."
    );

    const update: any = {
      cv_storage_path: data.storage_path,
      cv_url: signed?.signedUrl ?? null,
      parsed_cv_text: data.cv_text.slice(0, 50000),
      cv_parsed_at: new Date().toISOString(),
      full_name: extracted.full_name || undefined,
      email: extracted.email || undefined,
      phone: extracted.phone || undefined,
      linkedin_url: extracted.linkedin_url || undefined,
      preferred_county: extracted.preferred_county || undefined,
      skills: extracted.skills?.length ? extracted.skills : undefined,
      desired_roles: extracted.desired_roles?.length ? extracted.desired_roles : undefined,
      professional_summary: extracted.professional_summary || undefined,
      work_history: extracted.work_history || undefined,
      education: extracted.education || undefined,
      certifications: extracted.certifications || undefined,
      languages: extracted.languages || undefined,
    };
    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

    const { data: prof, error } = await supabase.from("profiles").update(update).eq("id", userId).select().single();
    if (error) throw error;
    return { profile: prof, extracted };
  });

// ---- Workflow ----
const workflowSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).default("My Workflow"),
  active: z.boolean().default(true),
  run_time: z.string().default("08:00"),
  run_days: z.array(z.string()).default(["mon", "tue", "wed", "thu", "fri"]),
  target_roles: z.array(z.string()).default([]),
  target_counties: z.array(z.string()).default([]),
  target_companies: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
  job_types: z.array(z.string()).default([]),
  min_match_score: z.number().int().min(0).max(100).default(70),
  max_applications: z.number().int().min(1).max(100).default(10),
  minimum_salary: z.number().int().optional().nullable(),
  cover_letter_tone: z.string().default("Formal"),
  auto_apply: z.boolean().default(false),
});

export const getMyWorkflow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("workflows").select("*").eq("user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle();
    return { workflow: data };
  });

export const upsertWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => workflowSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = { ...data, user_id: userId, minimum_salary: data.minimum_salary ?? null };
    if (data.id) {
      const { data: upd, error } = await supabase.from("workflows").update(row).eq("id", data.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return { workflow: upd };
    }
    const { data: ins, error } = await supabase.from("workflows").insert(row).select().single();
    if (error) throw error;
    return { workflow: ins };
  });

// ---- Application Assistant Pack (for HR-SaaS / form-based listings) ----
export const generateApplicationPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: job }, { data: profile }] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", data.jobId).eq("user_id", userId).single(),
      supabase.from("profiles").select("*").eq("id", userId).single(),
    ]);
    if (!job || !profile) throw new Error("Missing job or profile");

    const pack = await aiJson<{
      cover_letter: string;
      email_subject: string;
      email_body: string;
      questions_and_answers: { question: string; answer: string }[];
      key_facts: { label: string; value: string }[];
    }>(
      `Build an Application Assistant Pack for this Kenyan job listing whose application is a web form (no email).\n\nCANDIDATE: ${profile.full_name ?? ""} / ${profile.email ?? ""} / ${profile.phone ?? ""}\nSKILLS: ${(profile.skills ?? []).join(", ")}\nSUMMARY: ${profile.professional_summary ?? ""}\nWORK: ${profile.work_history ?? ""}\nEDUCATION: ${profile.education ?? ""}\n\nJOB: ${job.title} at ${job.company ?? ""}\nDESC: ${(job.description ?? "").slice(0, 4000)}\nREQS: ${job.requirements ?? ""}\n\nReturn JSON with: cover_letter (~300 words), email_subject, email_body (5 sentences), questions_and_answers (array of 8-12 likely form questions like 'Why this role?', 'Years of experience with X?', 'Salary expectation in KES?', 'Notice period?', 'Are you authorised to work in Kenya?', etc. with tailored answers), key_facts (label/value pairs the user copies into single fields: Full name, Email, Phone, LinkedIn, Location, Years of experience, Notice period, Salary expectation, Earliest start date).`,
      "You are a Kenyan job-application assistant. Return strict JSON only."
    );

    const packText = `# Application Pack: ${job.title} — ${job.company ?? ""}\n\n## Key Facts (copy into single fields)\n${pack.key_facts.map(f => `- **${f.label}:** ${f.value}`).join("\n")}\n\n## Cover Letter\n${pack.cover_letter}\n\n## Email Subject\n${pack.email_subject}\n\n## Email Body\n${pack.email_body}\n\n## Likely Form Questions\n${pack.questions_and_answers.map((q,i) => `### ${i+1}. ${q.question}\n${q.answer}`).join("\n\n")}\n\n---\nApplication URL: ${job.source_url ?? ""}\n`;

    let driveFileId: string | null = null;
    let driveUrl: string | null = null;
    let folderId: string | null = null;
    try {
      const root = await findOrCreateFolder("JobHunter KE");
      folderId = await findOrCreateFolder(`${job.company ?? "Company"} - ${job.title}`.slice(0, 120), root);
      const up = await uploadTextFile(`Application Pack - ${job.title} - ${new Date().toISOString().slice(0,10)}.md`, packText, folderId);
      driveFileId = up.id; driveUrl = up.webViewLink;
    } catch (e) { console.error("Drive pack upload failed:", e); }

    const { data: existing } = await supabase.from("applications").select("id").eq("user_id", userId).eq("job_id", data.jobId).maybeSingle();
    const row = {
      user_id: userId, job_id: data.jobId, job_title: job.title, company: job.company,
      cover_letter: pack.cover_letter, email_subject: pack.email_subject, email_body: pack.email_body,
      pack_questions: JSON.stringify(pack.questions_and_answers),
      pack_answers: JSON.stringify(pack.key_facts),
      application_type: "form" as const,
      match_score: job.match_score, status: "draft" as const,
      drive_file_id: driveFileId, drive_url: driveUrl, drive_folder_id: folderId,
    };
    if (existing) {
      const { data: upd, error } = await supabase.from("applications").update(row).eq("id", existing.id).select().single();
      if (error) throw error;
      return { application: upd, pack };
    } else {
      const { data: ins, error } = await supabase.from("applications").insert(row).select().single();
      if (error) throw error;
      return { application: ins, pack };
    }
  });

