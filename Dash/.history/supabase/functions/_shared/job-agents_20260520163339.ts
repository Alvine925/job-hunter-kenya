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
    `STRICT INSTRUCTIONS: Use the provided template structure exactly. Replace ALL {{PLACEHOLDER}} variables with actual data from the candidate profile and job details. Do NOT deviate from the template structure.

COVER LETTER TEMPLATE TO FOLLOW:
${template}

CANDIDATE DATA TO EXTRACT FROM:
NAME: ${profile.full_name ?? ""}
EMAIL: ${profile.email ?? ""}
PHONE: ${profile.phone ?? ""}
SKILLS: ${(profile.skills ?? []).join(", ")}
PROFESSIONAL SUMMARY: ${profile.professional_summary ?? ""}
WORK HISTORY: ${profile.work_history ?? ""}
EDUCATION: ${profile.education ?? ""}
YEARS OF EXPERIENCE: ${profile.years_of_experience ?? "Not specified"}

JOB INFORMATION:
TITLE: ${job.title}
COMPANY: ${job.company ?? ""}
LOCATION: ${job.location ?? ""}
DESCRIPTION: ${(job.description ?? "").slice(0, 4000)}
REQUIREMENTS: ${job.requirements ?? ""}

TONE PREFERENCE: ${tone}

REPLACEMENT RULES:
1. Replace {{FULL_NAME}} with the candidate's full name
2. Replace {{PROFESSION}} with their main job title/profession
3. Replace {{YEARS_OF_EXPERIENCE}} with extracted years from profile
4. Replace {{INDUSTRY_SPECIALIZATION}} with their main industry/specialization
5. Replace {{POSITION}} with the job title they're applying for
6. Replace {{COMPANY_NAME}} with the company name (use same name each time)
7. Replace {{KEY_SKILLS}} with their most relevant skills to this job (comma-separated)
8. Replace {{COMPANY_MISSION_OR_VALUES}} with inferred company focus from job description
9. Replace {{COMPANY_STRENGTHS}} with company qualities from job listing
10. Replace {{CAREER_PASSION}} with their professional passion/focus area
11. Replace {{MAJOR_ACHIEVEMENTS}} with key achievements from their work history
12. Replace {{CORE_COMPETENCIES}} with main professional competencies
13. Replace {{QUANTIFIABLE_RESULTS}} with specific measurable results from their work
14. Replace {{TECHNICAL_SKILLS}} with relevant technical/software skills
15. Replace {{UNIQUE_VALUE_PROPOSITION}} with how they uniquely help the company
16. Replace {{BUSINESS_IMPACT_AREA}} with specific business areas they can improve
17. Replace {{STRATEGIC_OUTCOMES}} with business outcomes they can help achieve
18. Replace {{METHODOLOGY_OR_APPROACH}} with their work approach/methodology
19. Replace {{PROFESSIONAL_ATTRIBUTES}} with positive professional traits
20. Replace {{WORK_ETHIC_TRAITS}} with work ethic descriptors
21. Replace {{SUCCESS_MEASURE}} with their definition of success

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON with key "cover_letter"
- The cover letter must be 300-350 words
- All {{PLACEHOLDER}} variables MUST be replaced with actual content
- No placeholders should remain in the output
- Follow the exact template structure with all 6 sections
- Maintain professional tone throughout
- Make it personalized and tailored to the specific job`,
    "You are an expert Kenyan career coach writing tailored cover letters. You must strictly follow the template structure provided and replace all placeholders. Output only valid JSON with the cover_letter key. Never deviate from the template format.",
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
