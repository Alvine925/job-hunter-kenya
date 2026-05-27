import { aiJson } from "./ai.ts";

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

export async function runJobMatchingAgent(params: {
  profileSummary: string;
  job: { title: string; source_url: string; description?: string | null };
  template?: string | null;
}) {
  const { profileSummary, job, template } = params;
  return aiJson<JobMatchAnalysis>(
    `Analyze this job listing for the candidate.

${template ? `MATCHING TEMPLATE / RUBRIC:\n${template}\n\n` : ""}CANDIDATE:
${profileSummary}

JOB TITLE: ${job.title}
JOB SOURCE: ${job.source_url}
JOB CONTENT:
${(job.description ?? "").slice(0, 6000)}

Return JSON with keys: match_score (0-100 integer), match_reason (2-3 sentences explaining why it matches or does not), match_strengths (bullet list as string), match_gaps (bullet list as string), requirements (string), responsibilities (string), salary_text (string or empty), job_type (Full-time/Part-time/Contract/Internship), company (string), location (string), county (Kenyan county or empty), application_email (string or empty), application_url (string or empty), application_method ("email" if applicants send email, "form" if applicants use an online form/ATS/SaaS application portal, otherwise "unknown"), contact_person (string or empty), contact_phone (string or empty).`,
    "You are a job-matching analyst for the Kenyan job market. Be concise, factual. Output strict JSON only.",
  );
}

export async function runCoverLetterAgent(params: {
  profile: any;
  job: any;
  tone: string;
  template?: string | null;
}) {
  const { profile, job, tone, template } = params;
  
  if (!template) {
    throw new Error("Cover letter template is required");
  }

  return aiJson<CoverLetterDraft>(
    `You are an expert Kenyan career coach. Use the provided template as a structural guide and format reference. Follow its sections and style, but personalize ALL content with the candidate's actual CV data and job details.

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
9. Return JSON with key "cover_letter" only

Create a cover letter that reads like the template but with all real content about THIS candidate for THIS job.`,
    "You are an expert career coach. Output strict JSON only.",
  );
}

export async function runEmailDraftAgent(params: {
  profile: any;
  job: any;
  coverLetter: string;
  template?: string | null;
}) {
  const { profile, job, coverLetter, template } = params;
  return aiJson<EmailDraft>(
    `Draft the application email subject and body.

${template ? `EMAIL TEMPLATE:\n${template}\n\n` : ""}CANDIDATE: ${profile.full_name ?? ""} / ${profile.email ?? ""} / ${profile.phone ?? ""}
JOB: ${job.title} at ${job.company ?? ""}
APPLICATION EMAIL: ${job.application_email ?? ""}
COVER LETTER:
${coverLetter.slice(0, 3000)}

Return JSON with keys email_subject and email_body. The email body should be 4-6 concise sentences, mention the attached CV, and be ready to send.`,
    "You write polished professional job application emails. Output strict JSON only.",
  );
}

export async function runFormApplicationAgent(params: {
  profile: any;
  job: any;
  applicationPage: string;
  template?: string | null;
}) {
  const { profile, job, applicationPage, template } = params;
  return aiJson<FormDraft>(
    `Build an Application Assistant Pack for this Kenyan job listing whose application is a web form or SaaS ATS page.

${template ? `FORM RESPONSE TEMPLATE:\n${template}\n\n` : ""}CANDIDATE: ${profile.full_name ?? ""} / ${profile.email ?? ""} / ${profile.phone ?? ""}
SKILLS: ${(profile.skills ?? []).join(", ")}
SUMMARY: ${profile.professional_summary ?? ""}
WORK: ${profile.work_history ?? ""}
EDUCATION: ${profile.education ?? ""}

JOB: ${job.title} at ${job.company ?? ""}
DESC: ${(job.description ?? "").slice(0, 4000)}
REQS: ${job.requirements ?? ""}
APPLICATION URL: ${job.application_url ?? job.source_url ?? ""}
APPLICATION PAGE CONTENT:
${applicationPage.slice(0, 6000)}

Return JSON with: cover_letter (~300 words), email_subject, email_body (5 sentences), questions_and_answers (array of actual fields/questions detected from the application page when visible, otherwise likely form questions, each with a copy-paste-ready tailored answer), key_facts (label/value pairs for common form fields: Full name, Email, Phone, LinkedIn, Location, Years of experience, Notice period, Salary expectation, Earliest start date).`,
    "You are a Kenyan job-application assistant. Return strict JSON only.",
  );
}
