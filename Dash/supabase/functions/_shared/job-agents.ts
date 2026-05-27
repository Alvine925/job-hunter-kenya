import { aiJson } from "./ai.ts";
import type { SiteFormProfile } from "./site-form-profiles/types.ts";
import { siteProfileFieldSpec } from "./site-form-profiles/index.ts";
import type { SiteEmailProfile } from "./site-email-profiles/types.ts";
import { resolveSiteEmailProfile } from "./site-email-profiles/index.ts";

export type JobMatchAnalysis = {
  match_score: number;
  match_reason: string;
  match_strengths: string;
  match_gaps: string;
  requirements: string;
  responsibilities: string;
  salary_text: string;
  job_type: string;
  company: string;
  location: string;
  county: string;
  application_email: string;
  application_url: string;
  application_method: "email" | "form" | "unknown";
  contact_person: string;
  contact_phone: string;
  company_summary: string;
  role_description: string;
};

/** Full job + employer analysis for scraped_jobs catalog (no candidate matching). */
export type JobListingAnalysis = {
  title: string;
  company: string;
  company_summary: string;
  role_description: string;
  description_summary: string;
  description: string;
  requirements: string;
  responsibilities: string;
  salary_text: string;
  job_type: string;
  work_type: string;
  location: string;
  county: string;
  application_email: string;
  application_url: string;
  application_method: "email" | "form" | "unknown";
  contact_person: string;
  contact_phone: string;
  deadline_text: string;
  sector: string;
  experience_level: string;
  education_level: string;
  is_valid_job: boolean;
};

export type CoverLetterDraft = {
  cover_letter: string;
};

export type EmailDraft = {
  email_subject: string;
  email_body: string;
};

export type FormDraft = {
  cover_letter: string;
  email_subject: string;
  email_body: string;
  questions_and_answers: { question: string; answer: string }[];
  key_facts: { label: string; value: string }[];
};

export type InterviewPrepDraft = {
  questions_and_answers: { question: string; answer: string }[];
};

export type MonitorExtractedJob = {
  title: string;
  source_url: string;
  company?: string;
  description?: string;
  deadline?: string;
  deadline_text?: string;
};

export type MonitorExtractResult = {
  jobs: MonitorExtractedJob[];
};

export async function runJobMatchingAgent(params: {
  profileSummary: string;
  job: { title: string; source_url: string; description?: string | null };
  template?: string | null;
  siteEmailHint?: string | null;
}) {
  const { profileSummary, job, template, siteEmailHint } = params;
  return aiJson<JobMatchAnalysis>(
    `Analyze this job listing for the candidate.

${siteEmailHint ?? ""}${template ? `MATCHING TEMPLATE / RUBRIC:\n${template}\n\n` : ""}CANDIDATE:
${profileSummary}

JOB TITLE: ${job.title}
JOB SOURCE: ${job.source_url}
JOB CONTENT:
${(job.description ?? "").slice(0, 6000)}

Return JSON with keys: match_score (0-100 integer), match_reason (2-3 sentences), match_strengths (bullet list as string), match_gaps (bullet list as string), requirements (bullet list as string, one item per line), responsibilities (bullet list as string, one item per line), role_description (3-5 short paragraphs: clear job description for this specific role synthesized from the listing — role overview, key duties, who should apply; never paste job-board navigation or filters), salary_text (string or empty), job_type (Full-time/Part-time/Contract/Internship), company (string), company_summary (2-4 sentences about the hiring employer only: what they do, sector, and scale in Kenya — never list job-board menus, locations, or categories), location (string), county (Kenyan county or empty), application_email (string or empty — MUST be the exact employer/recruiter email from the listing when applicants send CV by email; look for "send applications to", mailto links, "apply to", "email your CV"; never invent; prefer careers@, hr@, jobs@ over noreply), application_url (string or empty), application_method ("email" if applicants send email, "form" if applicants use an online form/ATS/SaaS application portal, otherwise "unknown"), contact_person (string or empty), contact_phone (string or empty).

COMPANY: "company" must be the real hiring employer (e.g. Safaricom, Uber). Never use the job board as company (not LinkedIn, BrighterMonday, MyJobMag, Fuzu, "Various", or "Aggregated"). If the page is a search-results listing with many jobs, set company to empty string and match_score low.

company_summary must read like a brief About the employer section for a job seeker — not copied navigation or filter text from the listing site.

If the listing is a search-results page (many jobs, no single employer), return empty strings for company, company_summary, role_description, requirements, and responsibilities, and set match_score below 30.

Never write "Not specified in the provided job content" or similar placeholders — use empty string when information is missing.

VOICE: Write match_reason, match_strengths, and match_gaps for the job seeker reading the page. Always use "you" / "your" — never "the candidate" or third person.`,
    "You are a job-matching analyst for the Kenyan job market. Be concise, factual. Output strict JSON only.",
  );
}

type JobListingCoreAnalysis = {
  title: string;
  company: string;
  location: string;
  county: string;
  requirements: string;
  responsibilities: string;
  salary_text: string;
  job_type: string;
  work_type: string;
  application_email: string;
  application_url: string;
  application_method: "email" | "form" | "unknown";
  contact_person: string;
  contact_phone: string;
  deadline_text: string;
  sector: string;
  experience_level: string;
  education_level: string;
  is_valid_job: boolean;
};

type JobListingNarratives = {
  company_summary: string;
  role_description: string;
  description_summary: string;
};

const ANALYST_RULES = `Rules:
- If not a single job posting, set is_valid_job false and empty strings.
- Never use placeholder phrases like "Not specified" — use empty string if information is missing.
- company: The name of the actual hiring company/employer (e.g., Safaricom, Sidian Bank, Sidai Africa). NEVER output the job board name (do NOT output LinkedIn, BrighterMonday, MyJobMag, Fuzu, JobwebKenya, Corporate Staffing, or similar) or any city/county/country names (do NOT output Nairobi, Mombasa, Kisumu, Kenya, or similar) as the company. Analyze the entire description text and job details to identify the actual hiring employer. If the company name is not mentioned at all in the posting, use an empty string.
- application_email: The exact recruiter/employer email address to send applications or CVs to. Scan the page text carefully for phrases like "send your applications to", "email CV to", "submit applications via email to", etc. DO NOT invent an email. If the email has a domain of a job board (e.g., fuzu.com, linkedin.com, myjobmag.co.ke, jobwebkenya.com), IGNORE it unless it is explicitly the only email address given for applicant submissions. Never output contact/support emails of the job board itself.
- application_method: MUST be "email" if the page contains a valid application email address and instructs the candidate to send their CV/Resume/application via email. MUST be "form" if candidates are instructed to apply online, click an apply button, fill an ATS form, or submit through a portal link. If both are available or it is ambiguous, default to "email" if a valid application email is present in the text, otherwise default to "form".
- For requirements and responsibilities use pipe-separated items (item1 | item2), not JSON arrays.`;

/** AI analyst for board scrapers — two compact JSON calls (Lovable API first, Gemini fallback). */
export async function runJobListingAnalyst(params: {
  source_url: string;
  source: string;
  pageText: string;
  siteEmailHint?: string | null;
}): Promise<JobListingAnalysis> {
  const { source_url, source, pageText, siteEmailHint } = params;
  const excerpt = pageText.slice(0, 18_000);

  const core = await aiJson<JobListingCoreAnalysis>(
    `Extract structured metadata from this Kenyan job posting.

${siteEmailHint ?? ""}
JOB BOARD (not the employer): ${source}
URL: ${source_url}

PAGE TEXT:
${excerpt}

Return JSON only with keys: title, company, location, county, requirements, responsibilities, salary_text, job_type, work_type, application_email, application_url, application_method, contact_person, contact_phone, deadline_text, sector, experience_level, education_level, is_valid_job.

${ANALYST_RULES}`,
    "Kenyan job metadata extractor. Compact JSON only.",
  );

  if (core.is_valid_job === false) {
    return {
      ...core,
      company_summary: "",
      role_description: "",
      description_summary: "",
      description: "",
    };
  }

  let narratives: JobListingNarratives = {
    company_summary: "",
    role_description: "",
    description_summary: "",
  };

  try {
    narratives = await aiJson<JobListingNarratives>(
      `Write employer and role narratives for this job (Kenyan market).

Employer: ${core.company || "unknown"}
Title: ${core.title}
URL: ${source_url}

PAGE TEXT:
${excerpt.slice(0, 14_000)}

Return JSON only with keys: company_summary (max 500 chars), role_description (max 1800 chars, plain prose), description_summary (max 350 chars).
No JSON arrays. No markdown.`,
      "Write concise job catalog copy. JSON only.",
    );
  } catch (e) {
    console.warn("Narratives JSON failed, using minimal copy:", e);
  }

  return {
    ...core,
    ...narratives,
    description: "",
  };
}

export async function runCoverLetterAgent(params: {
  profile: any;
  job: any;
  tone: string;
  template?: string | null;
  letterDate?: string;
}) {
  const { profile, job, tone, template, letterDate } = params;

  if (!template) {
    throw new Error("Cover letter template is required");
  }

  const dateLine =
    letterDate ??
    new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Africa/Nairobi",
    });

  return aiJson<CoverLetterDraft>(
    `You are an expert Kenyan career coach. Use the provided template as a structural guide and format reference. Follow its sections and style, but personalize ALL content with the candidate's actual CV data and job details.

LETTER DATE (mandatory — use exactly this as the first line of the cover letter, do not invent or guess any other date):
${dateLine}

TEMPLATE STRUCTURE & FORMAT REFERENCE (follow this layout):
${template}

CANDIDATE DATA:
NAME: ${profile.full_name ?? ""}
EMAIL: ${profile.email ?? ""}
PHONE: ${profile.phone ?? ""}
SKILLS: ${(profile.skills ?? []).join(", ")}
PROFESSIONAL SUMMARY: ${profile.professional_summary ?? ""}
WORK HISTORY: ${profile.work_history ?? ""}
EDUCATION: ${profile.education ?? ""}
NOTICE PERIOD: ${profile.notice_period ?? ""}
YEARS OF EXPERIENCE: ${profile.years_of_experience ?? ""}
DESIRED SALARY: ${profile.minimum_salary ? `KES ${profile.minimum_salary.toLocaleString("en-KE")} per month` : ""}

JOB DETAILS:
TITLE: ${job.title}
COMPANY: ${job.company ?? ""}
LOCATION: ${job.location ?? ""}
DESCRIPTION: ${(job.description ?? "").slice(0, 4000)}
REQUIREMENTS: ${job.requirements ?? ""}

TONE: ${tone}

INSTRUCTIONS:
1. Use the template's 6-section structure as your guide
2. Maintain the same format, tone, and flow as the template
3. Replace all bracketed instructions and examples with real personalized content from the candidate's CV
4. Extract actual achievements, skills, and experience from the work history
5. Tailor all content specifically to this job and company
6. Keep the professional, structured format of the template
7. Write naturally - no placeholders or brackets should remain
8. Total length: 300-350 words
9. PLAIN TEXT ONLY: no markdown (#, *, bullets with asterisks, --- dividers, or em dashes). Use a normal hyphen (-) only. Section headings on their own line as "1. Introduction", "2. Why I Am Interested", etc. (no # prefix).
10. The first line of cover_letter MUST be exactly the LETTER DATE above — never use [Date], placeholders, or a different calendar day.
11. Do not include salary figures, notice periods, or start dates unless they appear in the candidate data below.
12. Return JSON with key "cover_letter" only

Create a cover letter that reads like the template but with all real content about THIS candidate for THIS job.`,
    "You are an expert career coach. Output strict JSON only.",
  );
}

export async function runEmailDraftAgent(params: {
  profile: any;
  job: any;
  coverLetter: string;
  template?: string | null;
  siteEmailProfile?: SiteEmailProfile | null;
}) {
  const { profile, job, coverLetter, template, siteEmailProfile } = params;
  const siteProfile =
    siteEmailProfile ?? resolveSiteEmailProfile(job.application_url ?? job.source_url, job.source);

  const siteBlock = siteProfile
    ? `${siteProfile.emailDraftTemplate}

Subject rule: ${siteProfile.subjectRule}
Body rules: ${siteProfile.bodyRules}

`
    : "";

  const subjectHint = siteProfile
    ? `email_subject MUST be exactly: ${job.title}`
    : "email_subject should be professional and mention the role";

  return aiJson<EmailDraft>(
    `Draft the application email subject and body.

${siteBlock}${template ? `USER EMAIL TEMPLATE:\n${template}\n\n` : ""}CANDIDATE: ${profile.full_name ?? ""} / ${profile.email ?? ""} / ${profile.phone ?? ""}
MIN SALARY (KES): ${profile.minimum_salary ?? "not set"}
NOTICE PERIOD: ${profile.notice_period ?? "not set"}
YEARS OF EXPERIENCE: ${profile.years_of_experience ?? "not set"}
JOB: ${job.title} at ${job.company ?? ""}
APPLICATION EMAIL: ${job.application_email ?? ""}
COVER LETTER:
${coverLetter.slice(0, 3000)}

Return JSON with keys email_subject and email_body. ${subjectHint}. The email body should mention the attached CV and be ready to send.`,
    "You write polished professional job application emails. Output strict JSON only.",
  );
}

export async function runFormApplicationAgent(params: {
  profile: any;
  job: any;
  applicationPage: string;
  template?: string | null;
  siteProfile?: SiteFormProfile | null;
}) {
  const { profile, job, applicationPage, template, siteProfile } = params;

  const siteBlock = siteProfile
    ? `SITE: ${siteProfile.name} (${siteProfile.id})
APPLY FLOW: ${siteProfile.applyFlowNote}

REQUIRED FORM FIELDS (return questions_and_answers in this exact order, question = label, one answer per field):
${JSON.stringify(siteProfileFieldSpec(siteProfile), null, 2)}

${siteProfile.formResponseTemplate}

`
    : "";

  const qaRule = siteProfile
    ? "questions_and_answers MUST include every field in REQUIRED FORM FIELDS above, in order, using each field's exact label as question."
    : "questions_and_answers (array of fields/questions detected from the application page when visible, otherwise likely form questions, each with a copy-paste-ready tailored answer)";

  const jsonStructure = `{
  "cover_letter": "~300 words, PLAIN TEXT only — no #, *, ---, or em dashes",
  "email_subject": "string",
  "email_body": "string",
  "questions_and_answers": [{"question": "string", "answer": "string"}, ...],
  "key_facts": [{"label": "Full name", "value": "..."}, {"label": "Email", "value": "..."}, {"label": "Phone", "value": "..."}, {"label": "LinkedIn", "value": "..."}, {"label": "Location", "value": "..."}, {"label": "Years of experience", "value": "..."}, {"label": "Notice period", "value": "..."}, {"label": "Salary expectation (KES)", "value": "..."}, {"label": "Earliest start date", "value": "..."}]
}`;

  return aiJson<FormDraft>(
    `Build an Application Assistant Pack for this Kenyan job listing whose application is a web form or SaaS ATS page.

${siteBlock}${template ? `USER FORM RESPONSE TEMPLATE:\n${template}\n\n` : ""}CANDIDATE: ${profile.full_name ?? ""} / ${profile.email ?? ""} / ${profile.phone ?? ""}
PREFERRED COUNTY: ${profile.preferred_county ?? ""}
MIN SALARY (KES): ${profile.minimum_salary ?? ""}
NOTICE PERIOD: ${profile.notice_period ?? ""}
YEARS OF EXPERIENCE: ${profile.years_of_experience ?? ""}
SKILLS: ${(profile.skills ?? []).join(", ")}
SUMMARY: ${profile.professional_summary ?? ""}
WORK: ${profile.work_history ?? ""}
EDUCATION: ${profile.education ?? ""}

JOB: ${job.title} at ${job.company ?? ""}
JOB TYPE: ${job.job_type ?? ""}
LOCATION: ${job.location ?? ""} / ${job.county ?? ""}
SALARY ON LISTING: ${job.salary_text ?? ""}
DESC: ${(job.description ?? "").slice(0, 4000)}
REQS: ${job.requirements ?? ""}
APPLICATION URL: ${job.application_url ?? job.source_url ?? ""}
APPLICATION PAGE CONTENT:
${applicationPage.slice(0, 6000)}

${qaRule}

CRITICAL: Return ONLY valid JSON in this exact structure (no markdown, no extra text):
${jsonStructure}`,
    "You are a Kenyan job-application assistant. Return STRICT JSON only. All arrays must be actual arrays, all values must be strings or null.",
  );
}

export async function runInterviewPrepAgent(params: {
  profile: any;
  job: any;
  existingQuestions?: { question: string; answer: string }[];
}) {
  const { profile, job, existingQuestions } = params;
  const existingBlock = existingQuestions?.length
    ? `\nEXISTING PREP (regenerate with fresh angles, do not copy verbatim):\n${
      existingQuestions.map((q) => `Q: ${q.question}\nA: ${q.answer}`).join("\n\n")
    }\n`
    : "";

  return aiJson<InterviewPrepDraft>(
    `Generate interview preparation Q&A for this candidate applying to this role.

CANDIDATE: ${profile.full_name ?? ""}
SKILLS: ${(profile.skills ?? []).join(", ")}
SUMMARY: ${profile.professional_summary ?? ""}
WORK: ${(profile.work_history ?? "").slice(0, 2500)}
EDUCATION: ${profile.education ?? ""}
NOTICE PERIOD: ${profile.notice_period ?? ""}
YEARS OF EXPERIENCE: ${profile.years_of_experience ?? ""}
DESIRED SALARY: ${profile.minimum_salary ? `KES ${profile.minimum_salary.toLocaleString("en-KE")} per month` : ""}

ROLE: ${job.title}
COMPANY: ${job.company ?? ""}
LOCATION: ${job.location ?? ""} / ${job.county ?? ""}
REQUIREMENTS: ${job.requirements ?? ""}
RESPONSIBILITIES: ${job.responsibilities ?? ""}
MATCH STRENGTHS: ${job.match_strengths ?? ""}
MATCH GAPS: ${job.match_gaps ?? ""}
DESCRIPTION: ${(job.description ?? "").slice(0, 3000)}
${existingBlock}

Return JSON with key questions_and_answers: an array of 10-12 objects, each with:
- question: what a recruiter at ${job.company ?? "this company"} would ask for "${job.title}"
- answer: a strong sample answer the candidate can study (first person, 2-4 sentences, grounded in their CV; honest about gaps with a positive spin)

Include this mix (one question each unless noted):
1. Tell me about yourself
2. Why should we hire you? / What would you bring to ${job.company ?? "the organization"}?
3. Why this role and company?
4. A critical-thinking or situational question (hypothetical scenario for this job)
5. A life-skills question (communication, teamwork, handling pressure, or conflict)
6. Greatest strength
7. A weakness and how you manage it
8. Salary expectations (KES, realistic for Kenya)
9. Notice period / availability
10. Two duty-specific questions from the listing`,
    "You are an expert interview coach for the Kenyan job market. Output strict JSON only.",
  );
}

export async function extractJobsFromMonitorPage(params: {
  monitorUrl: string;
  monitorName: string;
  markdown: string;
}) {
  const { monitorUrl, monitorName, markdown } = params;
  const baseHost = (() => {
    try {
      return new URL(monitorUrl).hostname;
    } catch {
      return "";
    }
  })();

  return aiJson<MonitorExtractResult>(
    `Extract job postings from this monitored careers/jobs page.

MONITOR NAME: ${monitorName}
MONITOR URL (exact page scraped): ${monitorUrl}
SITE HOST: ${baseHost}

PAGE CONTENT (markdown):
${markdown.slice(0, 12000)}

Return JSON with key "jobs": an array of objects, each with:
- title (string, required)
- source_url (string, required — absolute URL to the individual job posting; use monitor URL only if this page IS a single job listing)
- company (string, optional)
- description (string, optional, short snippet)
- deadline (ISO date YYYY-MM-DD if visible, else empty string)
- deadline_text (raw deadline text from page if any)

Rules:
- Include every distinct job opening linked or listed on this page.
- Prefer links that stay on ${baseHost} or known career paths.
- Skip navigation, footer, and non-job links.
- If the page is a single job detail, return exactly one job with source_url = monitor URL.
- If no jobs found, return "jobs": [].`,
    "You extract structured job listings from career pages. Return strict JSON only.",
  );
}
