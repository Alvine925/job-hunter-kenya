import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { formatCoverLetterForStorage, formatKenyanLetterDate } from "./document-format.ts";
import {
  createGoogleDocFormatted,
  createGoogleDocFromText,
  findOrCreateFolder,
  uploadBinaryFile,
  uploadTextFile,
} from "./drive.ts";
import { resolveApplicationEmailFromListing } from "./resolve-application-email.ts";
import { sendGmail } from "./gmail.ts";
import { scrapeUrlMarkdown } from "./firecrawl.ts";
import {
  runCoverLetterAgent,
  runEmailDraftAgent,
  runFormApplicationAgent,
  runInterviewPrepAgent,
} from "./job-agents.ts";
import { resolveSiteFormProfile } from "./site-form-profiles/index.ts";
import { resolveSiteEmailProfile } from "./site-email-profiles/index.ts";

type SupabaseLike = any;

type ApplicationMode = "manual" | "automatic";

type GeneratedEmail = {
  cover_letter: string;
  email_subject: string;
  email_body: string;
};

type GeneratedPack = GeneratedEmail & {
  questions_and_answers: { question: string; answer: string }[];
  key_facts: { label: string; value: string }[];
};

const DRIVE_ROOT_FOLDER_NAME = "Tellus";

function sanitizeDriveName(value: string) {
  return value.replace(/[\\/:*?"<>|#{}%~&]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Untitled Job";
}

function mimeTypeForPath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "doc") return "application/msword";
  if (ext === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

async function createJobFolder(
  job: any,
  googleAccessToken?: string | null,
) {
  if (!googleAccessToken) {
    return { folderId: null, folderUrl: null };
  }

  const root = await findOrCreateFolder(DRIVE_ROOT_FOLDER_NAME, googleAccessToken);
  const folderId = await findOrCreateFolder(
    sanitizeDriveName(job.title),
    googleAccessToken,
    root,
  );
  return {
    folderId,
    folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
  };
}

async function uploadApplicationFiles(params: {
  job: any;
  googleAccessToken?: string | null;
  files: { name: string; content: string; asGoogleDoc?: boolean }[];
}) {
  const { job, googleAccessToken, files } = params;
  if (!googleAccessToken) {
    return {
      driveFileId: null,
      driveUrl: null,
      folderId: null,
      coverLetterDocUrl: null,
    };
  }

  const folder = await createJobFolder(job, googleAccessToken);
  if (!folder.folderId) {
    return {
      driveFileId: null,
      driveUrl: null,
      folderId: null,
      coverLetterDocUrl: null,
    };
  }

  let coverLetterDocId: string | null = null;
  let coverLetterDocUrl: string | null = null;

  for (const file of files) {
    const uploaded = file.asGoogleDoc
      ? await createGoogleDocFormatted(
        file.name,
        file.content,
        folder.folderId,
        googleAccessToken,
      )
      : await uploadTextFile(
        `${sanitizeDriveName(file.name)}.txt`,
        file.content,
        folder.folderId,
        googleAccessToken,
      );
    if (file.asGoogleDoc) {
      coverLetterDocId = uploaded.id;
      coverLetterDocUrl = uploaded.webViewLink;
    }
  }

  return {
    driveFileId: coverLetterDocId,
    driveUrl: folder.folderUrl,
    folderId: folder.folderId,
    coverLetterDocUrl,
  };
}

export type InterviewQa = { question: string; answer: string };

export function formatInterviewPrepMarkdown(
  job: { title?: string; company?: string | null },
  questions: InterviewQa[],
) {
  return `# Interview Prep — ${job.title ?? "Role"}${job.company ? ` at ${job.company}` : ""}

Practice questions and sample answers for your mock interview and recruiter conversations.

${questions.map((q, i) => `## ${i + 1}. ${q.question}\n\n${q.answer}`).join("\n\n")}
`;
}

export function summarizeApplicationForJobList(app: Record<string, unknown> | null) {
  if (!app) return null;
  const cover = String(app.cover_letter ?? "").trim();
  const packQ = app.pack_questions;
  const emailBody = String(app.email_body ?? "").trim();
  const emailSub = String(app.email_subject ?? "").trim();
  const hasContent = !!(cover || packQ || (emailBody && emailSub));
  const status = app.status as string | null;
  const preparedAt = app.prepared_at;
  const driveUrl = app.drive_url;
  const hasPack = hasContent && !!(preparedAt || driveUrl || status);

  let label: string | null = null;
  if (status === "sent") label = "Applied";
  else if (hasPack) label = "Pack ready";
  else if (status === "draft" || status === "needs_review") label = "Draft";

  return {
    has_pack: hasPack,
    has_interview_prep: !!app.interview_questions,
    status,
    label,
  };
}

async function loadExistingInterviewQuestions(
  supabase: SupabaseLike,
  userId: string,
  jobId: string,
): Promise<InterviewQa[]> {
  const { data: existingApp } = await supabase
    .from("applications")
    .select("interview_questions")
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .maybeSingle();

  if (!existingApp?.interview_questions) return [];
  try {
    const parsed = JSON.parse(existingApp.interview_questions as string) as InterviewQa[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Generate interview Q&A for inclusion in application packs. */
export async function generateInterviewPrepForJob(params: {
  supabase: SupabaseLike;
  userId: string;
  job: any;
  profile: any;
}) {
  const existingQuestions = await loadExistingInterviewQuestions(
    params.supabase,
    params.userId,
    params.job.id,
  );
  const prep = await runInterviewPrepAgent({
    profile: params.profile,
    job: params.job,
    existingQuestions,
  });
  return prep.questions_and_answers;
}

function jobQualificationsDoc(job: any) {
  return `# Job Qualifications - ${job.title}

Company: ${job.company ?? ""}
Location: ${job.location ?? ""}
Source: ${job.source_url ?? ""}

## Requirements
${job.requirements ?? "No extracted requirements."}

## Responsibilities
${job.responsibilities ?? "No extracted responsibilities."}

## Salary
${job.salary_text ?? "Not listed."}
`;
}

function matchingDoc(job: any) {
  return `# Matching Analysis - ${job.title}

Match score: ${job.match_score ?? 0}%

## Reason
${job.match_reason ?? "No match reason available."}

## Strengths
${job.match_strengths ?? "No strengths extracted."}

## Gaps
${job.match_gaps ?? "No gaps extracted."}
`;
}

async function getTemplate(supabase: SupabaseLike, userId: string, type: string) {
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

async function getExistingApplication(supabase: SupabaseLike, userId: string, jobId: string) {
  const { data } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .maybeSingle();
  return data ?? null;
}

async function getCvAttachment(supabase: SupabaseLike, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("cv_storage_path")
    .eq("id", userId)
    .single();

  if (!profile?.cv_storage_path) return undefined;

  const { data: file, error } = await supabase.storage
    .from("cvs")
    .download(profile.cv_storage_path);
  if (error) throw new Error(`CV download failed: ${error.message}`);

  const filename = profile.cv_storage_path.split("/").pop() || "CV.pdf";
  return {
    filename,
    mimeType: mimeTypeForPath(filename),
    data: new Uint8Array(await file.arrayBuffer()),
  };
}

async function upsertApplication(supabase: SupabaseLike, userId: string, jobId: string, row: Record<string, unknown>) {
  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("applications")
      .update(row)
      .eq("id", existing.id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("applications")
    .insert({ user_id: userId, job_id: jobId, ...row })
    .select()
    .single();
  if (error) throw error;
  return data;
}

function normalizeStoredEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s || s.toLowerCase() === "null" || !s.includes("@")) return null;
  return s;
}

export async function ensureJobApplicationEmail(
  supabase: SupabaseLike,
  job: any,
): Promise<any> {
  if (normalizeStoredEmail(job.application_email)) return job;

  const resolved = await resolveApplicationEmailFromListing(job);
  if (!resolved.application_email) return job;

  const patch: Record<string, unknown> = {
    application_email: resolved.application_email,
    application_method: "email",
  };
  if (resolved.description && resolved.description.length > (job.description?.length ?? 0)) {
    patch.description = resolved.description;
  }

  await supabase.from("jobs").update(patch).eq("id", job.id);
  return { ...job, ...patch };
}

export async function generateEmailApplication(params: {
  supabase: SupabaseLike;
  userId: string;
  job: any;
  profile: any;
  tone?: string;
  mode?: ApplicationMode;
  googleAccessToken?: string | null;
}) {
  const { supabase, userId, profile, tone = "Formal", mode = "manual", googleAccessToken } = params;
  let job = await ensureJobApplicationEmail(supabase, params.job);

  const [coverTemplate, emailTemplate] = await Promise.all([
    getTemplate(supabase, userId, "cover_letter"),
    getTemplate(supabase, userId, "email_body"),
  ]);
  const letterDate = formatKenyanLetterDate();
  const [cover, interviewQuestions] = await Promise.all([
    runCoverLetterAgent({
      profile,
      job,
      tone,
      template: coverTemplate,
      letterDate,
    }),
    generateInterviewPrepForJob({ supabase, userId, job, profile }),
  ]);
  const siteEmailProfile = resolveSiteEmailProfile(
    job.application_url ?? job.source_url,
    job.source,
  );
  const email = await runEmailDraftAgent({
    profile,
    job,
    coverLetter: cover.cover_letter,
    template: emailTemplate,
    siteEmailProfile,
  });
  const out: GeneratedEmail = {
    cover_letter: formatCoverLetterForStorage(cover.cover_letter, letterDate),
    email_subject: email.email_subject,
    email_body: email.email_body,
  };

  let driveFileId: string | null = null;
  let driveUrl: string | null = null;
  let folderId: string | null = null;
  const driveFiles: { name: string; content: string; asGoogleDoc?: boolean }[] = [
    {
      name: `Cover Letter - ${job.title}`,
      content: out.cover_letter,
      asGoogleDoc: true,
    },
    {
      name: `Email Draft - ${job.title}`,
      content: `Subject: ${out.email_subject}\n\n${out.email_body}`,
    },
    {
      name: `Interview Prep - ${job.title}`,
      content: formatInterviewPrepMarkdown(job, interviewQuestions),
      asGoogleDoc: true,
    },
    { name: `Job Qualifications - ${job.title}`, content: jobQualificationsDoc(job), asGoogleDoc: true },
    { name: `Matching Analysis - ${job.title}`, content: matchingDoc(job), asGoogleDoc: true },
  ];

  if (googleAccessToken) {
    try {
      const uploaded = await uploadApplicationFiles({
        job,
        googleAccessToken,
        files: driveFiles,
      });
      driveFileId = uploaded.driveFileId;
      driveUrl = uploaded.coverLetterDocUrl;
      folderId = uploaded.folderId;
    } catch (e) {
      console.error("Drive upload failed:", e);
    }
  }

  const application = await upsertApplication(supabase, userId, job.id, {
    job_title: job.title,
    company: job.company,
    cover_letter: out.cover_letter,
    email_subject: out.email_subject,
    email_body: out.email_body,
    interview_questions: JSON.stringify(interviewQuestions),
    match_score: job.match_score,
    status: mode === "automatic" ? "prepared" : "draft",
    application_type: "email",
    application_mode: mode,
    application_email: normalizeStoredEmail(job.application_email),
    application_url: job.application_url ?? job.source_url,
    automation_error: null,
    prepared_at: new Date().toISOString(),
    drive_file_id: driveFileId,
    drive_url: driveUrl ?? undefined,
    drive_folder_id: folderId,
  });

  return { application, generated: out };
}

export async function generateFormApplicationPack(params: {
  supabase: SupabaseLike;
  userId: string;
  job: any;
  profile: any;
  mode?: ApplicationMode;
  googleAccessToken?: string | null;
}) {
  const { supabase, userId, job, profile, mode = "manual", googleAccessToken } = params;
  let applicationPage = "";
  const applicationUrl = job.application_url ?? job.source_url;
  if (applicationUrl) {
    try {
      applicationPage = await scrapeUrlMarkdown(applicationUrl);
    } catch (e) {
      console.error("Application page scrape failed:", e);
    }
  }

  const siteProfile = resolveSiteFormProfile(
    job.application_url ?? job.source_url,
    job.source,
  );
  const template = await getTemplate(supabase, userId, "form_response");
  const [pack, interviewQuestions] = await Promise.all([
    runFormApplicationAgent({
      profile,
      job,
      applicationPage,
      template,
      siteProfile,
    }),
    generateInterviewPrepForJob({ supabase, userId, job, profile }),
  ]);
  const letterDate = formatKenyanLetterDate();
  pack.cover_letter = formatCoverLetterForStorage(pack.cover_letter, letterDate);

  // Ensure key_facts is an array (defensive handling for AI response parsing)
  if (!Array.isArray(pack.key_facts)) {
    console.error("Invalid key_facts format from AI:", typeof pack.key_facts, pack.key_facts);
    // Try to convert from object to array if it's an object
    if (typeof pack.key_facts === "object" && pack.key_facts !== null) {
      try {
        pack.key_facts = Object.entries(pack.key_facts).map(([label, value]) => ({
          label,
          value: String(value),
        }));
      } catch (e) {
        console.error("Failed to convert key_facts from object:", e);
        pack.key_facts = [];
      }
    } else {
      pack.key_facts = [];
    }
  }

  // Ensure questions_and_answers is an array
  if (!Array.isArray(pack.questions_and_answers)) {
    console.error("Invalid questions_and_answers format from AI:", typeof pack.questions_and_answers, pack.questions_and_answers);
    pack.questions_and_answers = [];
  }

  // Sanitize array contents
  pack.key_facts = pack.key_facts.filter((f) => typeof f === "object" && f !== null && "label" in f && "value" in f);
  pack.questions_and_answers = pack.questions_and_answers.filter(
    (q) => typeof q === "object" && q !== null && "question" in q && "answer" in q,
  );

  const packText = `# Application Pack: ${job.title} - ${job.company ?? ""}
${siteProfile ? `\n**Site form profile:** ${siteProfile.name}\n` : ""}

## Key Facts
${pack.key_facts.map((f) => `- **${f.label}:** ${f.value}`).join("\n")}

## Cover Letter
${pack.cover_letter}

## Email Subject
${pack.email_subject}

## Email Body
${pack.email_body}

## Likely Form Questions
${pack.questions_and_answers.map((q, i) => `### ${i + 1}. ${q.question}\n${q.answer}`).join("\n\n")}

## Interview Prep
${interviewQuestions.map((q, i) => `### ${i + 1}. ${q.question}\n${q.answer}`).join("\n\n")}

---
Application URL: ${job.application_url ?? job.source_url ?? ""}
`;

  let driveFileId: string | null = null;
  let driveUrl: string | null = null;
  let folderId: string | null = null;
  if (googleAccessToken) {
    try {
      const uploaded = await uploadApplicationFiles({
        job,
        googleAccessToken,
        files: [
          { name: `Application Form Responses - ${job.title}`, content: packText },
          {
            name: `Cover Letter - ${job.title}`,
            content: pack.cover_letter,
            asGoogleDoc: true,
          },
          { name: `Email Draft - ${job.title}`, content: `Subject: ${pack.email_subject}\n\n${pack.email_body}` },
          {
            name: `Interview Prep - ${job.title}`,
            content: formatInterviewPrepMarkdown(job, interviewQuestions),
            asGoogleDoc: true,
          },
          { name: `Job Qualifications - ${job.title}`, content: jobQualificationsDoc(job), asGoogleDoc: true },
          { name: `Matching Analysis - ${job.title}`, content: matchingDoc(job), asGoogleDoc: true },
        ],
      });
      driveFileId = uploaded.driveFileId;
      driveUrl = uploaded.coverLetterDocUrl;
      folderId = uploaded.folderId;
    } catch (e) {
      console.error("Drive pack upload failed:", e);
    }
  }

  const application = await upsertApplication(supabase, userId, job.id, {
    job_title: job.title,
    company: job.company,
    cover_letter: pack.cover_letter,
    email_subject: pack.email_subject,
    email_body: pack.email_body,
    pack_questions: JSON.stringify(pack.questions_and_answers),
    interview_questions: JSON.stringify(interviewQuestions),
    pack_answers: JSON.stringify({
      key_facts: pack.key_facts,
      site_profile_id: siteProfile?.id ?? null,
      site_profile_name: siteProfile?.name ?? null,
    }),
    application_type: "form",
    application_mode: mode,
    application_email: null,
    application_url: job.application_url ?? job.source_url,
    match_score: job.match_score,
    status: "needs_review",
    automation_error: mode === "automatic"
      ? "Online form applications are prepared as review packs because arbitrary third-party forms cannot be submitted from the background worker."
      : null,
    prepared_at: new Date().toISOString(),
    drive_file_id: driveFileId,
    drive_url: driveUrl,
    drive_folder_id: folderId,
  });

  return { application, pack, interview_questions: interviewQuestions };
}

export async function generateInterviewQuestions(params: {
  supabase: SupabaseLike;
  userId: string;
  job: any;
  profile: any;
}) {
  const { supabase, userId, job, profile } = params;

  const questions = await generateInterviewPrepForJob({ supabase, userId, job, profile });

  const row: Record<string, unknown> = {
    job_title: job.title,
    company: job.company,
    interview_questions: JSON.stringify(questions),
    match_score: job.match_score,
    status: "draft",
  };

  let application;
  try {
    application = await upsertApplication(supabase, userId, job.id, row);
  } catch (e) {
    const msg = String((e as { message?: string })?.message ?? e);
    if (/interview_questions|interview_session|interview_report/i.test(msg)) {
      throw new Error(
        "Interview prep columns are missing. Run migrations 20260522000000_interview_questions.sql and 20260522100000_interview_session_report.sql in the Supabase SQL editor.",
      );
    }
    throw e;
  }

  return { application, questions };
}

async function generateCoverLetterPdf(text: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let page = pdfDoc.addPage([595.276, 841.89]); // A4 size
  const { width, height } = page.getSize();
  
  const fontSize = 11;
  const margin = 50;
  const contentWidth = width - (2 * margin);
  
  const paragraphs = text.split("\n");
  let y = height - margin;
  
  for (const para of paragraphs) {
    if (!para.trim()) {
      y -= fontSize * 1.5; // blank line
      continue;
    }
    
    const words = para.split(" ");
    let line = "";
    
    // Choose font based on whether the paragraph looks like a header/title or standard text
    const isHeader = para.length < 90 && (
      /^\d+\.\s+[A-Za-z]/.test(para) || 
      (!/^(Dear\s|Yours\s|Sincerely|Kind\s+regards|Best\s+regards)/i.test(para) && para === para.toUpperCase())
    );
    const activeFont = isHeader ? boldFont : font;

    for (const word of words) {
      const testLine = line ? line + " " + word : word;
      const testLineWidth = activeFont.widthOfTextAtSize(testLine, fontSize);
      if (testLineWidth > contentWidth) {
        if (y < margin + (fontSize * 2)) {
          page = pdfDoc.addPage([595.276, 841.89]);
          y = height - margin;
        }
        page.drawText(line, { x: margin, y, size: fontSize, font: activeFont });
        y -= fontSize * 1.4; // Line height spacing
        line = word;
      } else {
        line = testLine;
      }
    }
    
    if (line) {
      if (y < margin + (fontSize * 2)) {
        page = pdfDoc.addPage([595.276, 841.89]);
        y = height - margin;
      }
      page.drawText(line, { x: margin, y, size: fontSize, font: activeFont });
      y -= fontSize * 1.6; // Paragraph spacing
    }
  }
  
  return await pdfDoc.save();
}

export async function sendPreparedEmailApplication(params: {
  supabase: SupabaseLike;
  userId: string;
  application: any;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  includeCv?: boolean;
  googleAccessToken: string;
}) {
  const { supabase, userId, application, googleAccessToken } = params;
  const to = params.to ?? application.application_email;
  const subject = params.subject ?? application.email_subject;
  const body = params.body ?? application.email_body;
  const includeCv = params.includeCv ?? true;

  if (!to || !subject || !body) {
    throw new Error("Missing recipient, subject, or body");
  }

  const attachments: { filename: string; mimeType: string; data: Uint8Array }[] = [];

  if (includeCv) {
    const cv = await getCvAttachment(supabase, userId);
    if (cv) {
      attachments.push(cv);
    }
  }

  if (application.cover_letter?.trim()) {
    try {
      const coverLetterData = await generateCoverLetterPdf(application.cover_letter);
      attachments.push({
        filename: "Cover Letter.pdf",
        mimeType: "application/pdf",
        data: coverLetterData,
      });
    } catch (err) {
      console.error("Failed to generate cover letter PDF:", err);
      // Fallback: attach as .txt file if pdf generation fails
      const encoder = new TextEncoder();
      attachments.push({
        filename: "Cover Letter.txt",
        mimeType: "text/plain",
        data: encoder.encode(application.cover_letter),
      });
    }
  }

  const sent = await sendGmail({
    to,
    cc: params.cc,
    bcc: params.bcc,
    subject,
    body,
    accessToken: googleAccessToken,
    attachments,
  });

  const { data, error } = await supabase
    .from("applications")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_via: "gmail",
      email_subject: subject,
      email_body: body,
      application_email: to,
      automation_error: null,
    })
    .eq("id", application.id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;

  return { application: data, gmailMessageId: sent.id };
}

export async function saveApplicationPackToDrive(params: {
  supabase: SupabaseLike;
  userId: string;
  job: any;
  application: any;
  email_subject: string;
  email_body: string;
  cover_letter: string;
  googleAccessToken: string;
}) {
  const {
    supabase,
    userId,
    job,
    application,
    email_subject,
    email_body,
    cover_letter,
    googleAccessToken,
  } = params;

  if (!googleAccessToken) {
    throw new Error("Connect Google in Settings to save files to Drive.");
  }
  if (!email_subject?.trim() || !email_body?.trim() || !cover_letter?.trim()) {
    throw new Error("Generate or complete the email and cover letter before saving to Drive.");
  }
  if (application.drive_pack_saved_at) {
    throw new Error("This application pack was already saved to Google Drive.");
  }

  const letterDate = formatKenyanLetterDate();
  const normalizedLetter = formatCoverLetterForStorage(cover_letter, letterDate);

  const cv = await getCvAttachment(supabase, userId);
  if (!cv) {
    throw new Error("Upload your CV in My CV before saving the application pack.");
  }

  const folder = await createJobFolder(job, googleAccessToken);
  if (!folder.folderId) {
    throw new Error("Could not create a Google Drive folder for this job.");
  }

  const recipient = normalizeStoredEmail(application.application_email) ??
    normalizeStoredEmail(job.application_email);
  const emailDocContent = [
    recipient ? `To: ${recipient}` : "To: (not listed on job — apply via employer site or form)",
    "",
    `Subject: ${email_subject.trim()}`,
    "",
    email_body.trim(),
  ].join("\n");

  await createGoogleDocFromText(
    `Email - ${sanitizeDriveName(job.title)}`,
    emailDocContent,
    folder.folderId,
    googleAccessToken,
  );

  const letterDoc = await createGoogleDocFormatted(
    `Cover Letter - ${sanitizeDriveName(job.title)}`,
    cover_letter,
    folder.folderId,
    googleAccessToken,
  );

  await uploadBinaryFile(
    cv.filename,
    cv.data,
    cv.mimeType,
    folder.folderId,
    googleAccessToken,
  );

  if (application.interview_questions) {
    try {
      const parsed = JSON.parse(application.interview_questions) as InterviewQa[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        await uploadTextFile(
          `Interview Prep - ${sanitizeDriveName(job.title)}.txt`,
          formatInterviewPrepMarkdown(job, parsed),
          folder.folderId,
          googleAccessToken,
        );
      }
    } catch (e) {
      console.warn("Interview prep Drive upload skipped:", e);
    }
  }

  const savedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("applications")
    .update({
      email_subject,
      email_body,
      cover_letter: normalizedLetter,
      drive_file_id: letterDoc.id,
      drive_url: folder.folderUrl,
      drive_folder_id: folder.folderId,
      drive_pack_saved_at: savedAt,
      automation_error: recipient
        ? null
        : "No apply-to email on this listing — pack saved to Drive for manual submission.",
    })
    .eq("id", application.id)
    .eq("user_id", userId)
    .is("drive_pack_saved_at", null)
    .select()
    .single();
  if (error) throw error;
  if (!data) {
    throw new Error("This application pack was already saved to Google Drive.");
  }

  return {
    application: data,
    folderUrl: folder.folderUrl,
    folderName: sanitizeDriveName(job.title),
  };
}

export async function prepareOrApplyJob(params: {
  supabase: SupabaseLike;
  userId: string;
  job: any;
  profile: any;
  mode: ApplicationMode;
  tone?: string;
  googleAccessToken?: string | null;
}) {
  const { supabase, userId, job, profile, mode, tone, googleAccessToken } = params;
  const existing = await getExistingApplication(supabase, userId, job.id);
  if (existing) {
    return { application: existing, action: "skipped_existing_application" };
  }

  if (job.application_email) {
    const prepared = await generateEmailApplication({
      supabase,
      userId,
      job,
      profile,
      tone,
      mode,
      googleAccessToken,
    });

    if (mode === "automatic") {
      if (!googleAccessToken) {
        const { data } = await supabase
          .from("applications")
          .update({
            status: "auth_required",
            automation_error: "Connect Google with Gmail permissions before automatic sending can run.",
          })
          .eq("id", prepared.application.id)
          .eq("user_id", userId)
          .select()
          .single();
        return { application: data, action: "auth_required" };
      }

      const sent = await sendPreparedEmailApplication({
        supabase,
        userId,
        application: prepared.application,
        googleAccessToken,
      });
      return { ...sent, action: "sent" };
    }

    return { ...prepared, action: "drafted" };
  }

  const pack = await generateFormApplicationPack({
    supabase,
    userId,
    job,
    profile,
    mode,
    googleAccessToken,
  });
  return { ...pack, action: "packed" };
}
