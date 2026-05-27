import type { AgentTemplateType } from "@/lib/api";

export type TemplateUserDetails = {
  fullName: string;
  firstName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  location: string;
  salaryLine: string;
  noticePeriod: string;
  yearsOfExperience: string;
};

type ProfileLike = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  preferred_county?: string | null;
  current_address?: string | null;
  minimum_salary?: number | null;
  notice_period?: string | null;
  years_of_experience?: string | null;
} | null | undefined;

export function pickTemplateUserDetails(
  profile: ProfileLike,
  authEmail?: string | null,
): TemplateUserDetails {
  const fullName = profile?.full_name?.trim() || "Your Name";
  const firstName = fullName.split(/\s+/)[0] || fullName;
  const email = profile?.email?.trim() || authEmail?.trim() || "your.email@example.com";
  const phone = profile?.phone?.trim() || "Your phone number";
  const linkedinUrl = profile?.linkedin_url?.trim() || "";
  const location =
    profile?.preferred_county?.trim() ||
    profile?.current_address?.trim() ||
    "Kenya";

  const salaryLine =
    profile?.minimum_salary != null && profile.minimum_salary > 0
      ? `KES ${profile.minimum_salary.toLocaleString("en-KE")} gross per month`
      : "KES [amount] gross per month";

  const noticePeriod = profile?.notice_period?.trim() || "Available immediately";
  const yearsOfExperience = profile?.years_of_experience?.trim() || "[X] years";

  return {
    fullName,
    firstName,
    email,
    phone,
    linkedinUrl,
    location,
    salaryLine,
    noticePeriod,
    yearsOfExperience,
  };
}

export function buildDefaultAgentTemplateContent(
  user: TemplateUserDetails,
): Record<AgentTemplateType, string> {
  const linkedinLine = user.linkedinUrl ? `\n${user.linkedinUrl}` : "";

  return {
    job_matching: `Score each job against ${user.fullName} (${user.email}) using:

- Required skills and tools (must-have vs nice-to-have)
- Years of experience and seniority fit
- Location (${user.location}), work mode, and salary band (KES gross monthly when listed)
- Sector and role alignment with career goals

Classify application method as email or form when possible.
Return a match score (0–100), short match reason, and key gaps.`,

    cover_letter: `[Date]

Hiring Manager
[Company Name]

Dear Hiring Manager,

# 1. Introduction

[Write a short professional introduction for ${user.fullName}: experience level, field, and the role ${user.firstName} is applying for.]

---

# 2. Why I Am Interested in the Role

[Why this role and company — align with mission, products, or industry.]

---

# 3. Why I Am Qualified

[Relevant experience, skills, and achievements that match the job description.]

---

# 4. Value I Can Bring to the Company

[How ${user.firstName}'s skills help the employer achieve goals — impact and contribution.]

---

# 5. Professional Qualities

[Work ethic, communication, teamwork, adaptability.]

---

# 6. Closing Statement

[Thank the employer and express interest in an interview.]

Sincerely,
${user.fullName}`,

    email_body: `Subject: [Job Title]

Dear Hiring Manager,

My name is ${user.fullName}. I am writing to apply for the [Job Title] position at [Company Name].

With ${user.yearsOfExperience} of experience in [relevant field], I have developed strong skills in [key skills from the job description]. I am confident I can contribute effectively to your team.

Salary expectations: ${user.salaryLine}
Notice period: ${user.noticePeriod}

Please find my CV attached for your review. I would welcome the opportunity to discuss my application further.

Best regards,
${user.fullName}
${user.phone}
${user.email}${linkedinLine}

---
Agent rules (edit or remove before saving):
- Keep the email concise (under 200 words before the signature).
- Always mention that the CV is attached.
- For My Jobs in Kenya listings: use the exact job title as the subject line; salary (KES) and notice period are required in the body.
- Use professional Kenyan English.`,

    form_response: `FORM APPLICATION RULES

Candidate: ${user.fullName}
Email: ${user.email}
Phone: ${user.phone}
${user.linkedinUrl ? `LinkedIn: ${user.linkedinUrl}\n` : ""}
When filling ATS or employer application forms:

- Use Kenyan English, professional tone.
- Use "${user.fullName}" wherever the form asks for full legal name.
- Answer each field directly — no placeholders in final answers.
- Salary: ${user.salaryLine.includes("[") ? "gross monthly in KSh" : user.salaryLine} unless the field specifies otherwise.
- Notice period / availability: ${user.noticePeriod}.
- For radio or dropdown fields, choose exactly one allowed option from the site.
- Cover letter fields: paste the full tailored letter, not bullet points.

For BrighterMonday and MyJobMag, follow the built-in site field order and labels.`,
  };
}

/** @deprecated Use buildDefaultAgentTemplateContent(pickTemplateUserDetails(...)) */
export const DEFAULT_AGENT_TEMPLATE_CONTENT = buildDefaultAgentTemplateContent(
  pickTemplateUserDetails(null),
);

export function resolveTemplateContent(
  type: AgentTemplateType,
  saved: string | null | undefined,
  user?: TemplateUserDetails | null,
): string {
  const trimmed = saved?.trim();
  if (trimmed) return trimmed;
  const details = user ?? pickTemplateUserDetails(null);
  return buildDefaultAgentTemplateContent(details)[type];
}
