import type { SiteEmailProfile } from "./types.ts";

/**
 * My Jobs in Kenya (myjobsinkenya.com) — applications via email per listing.
 * Instructions usually appear under "Terms and Conditions" on the job page.
 */
export const myJobsInKenyaProfile: SiteEmailProfile = {
  id: "myjobsinkenya",
  name: "My Jobs in Kenya",
  domains: ["myjobsinkenya.com", "www.myjobsinkenya.com"],
  defaultApplicationMethod: "email",
  alwaysScrapeFullPage: true,
  emailExtractionNote: `On My Jobs in Kenya, application instructions are almost always at the bottom of the job page under "Terms and Conditions".
Look for phrases like: "send applications to", "email your CV to", "submit applications to", "apply to".
Extract the employer/recruiter email (e.g. jobs@company.co.ke). Ignore noreply@, newsletter, and myjobsinkenya.com support addresses unless they are explicitly the apply-to address.`,
  subjectRule: "Use the exact job title as the email subject line (no prefix like 'Application for' unless the listing says so).",
  bodyRules: `The email body MUST clearly state:
1. Salary expectations (gross monthly in KES when possible)
2. Notice period / availability to start
Also mention attached CV, brief fit for the role, and candidate contact details.`,
  emailDraftTemplate: `MY JOBS IN KENYA — EMAIL APPLICATION RULES

This listing uses email apply (not an on-site form).

Subject line:
- Use the job title exactly as published on My Jobs in Kenya.

Email body must include:
- Salary expectations (KES, gross monthly if known from profile or reasonable for role)
- Notice period (e.g. "Available immediately" or "1 month notice")
- Short professional intro + why suitable for the role
- Mention CV is attached
- Sign off with full name, phone, email

Keep the email concise (under 200 words before cover letter attachment note).`,
};
