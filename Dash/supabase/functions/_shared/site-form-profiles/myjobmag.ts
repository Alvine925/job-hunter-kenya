import type { SiteFormProfile } from "./types.ts";

/**
 * MyJobMag Kenya — "Send Your Application" page (myjobmag.co.ke/job-application/{id}).
 * Fields captured from application UI, May 2026.
 */
export const myJobMagProfile: SiteFormProfile = {
  id: "myjobmag",
  name: "MyJobMag",
  domains: ["myjobmag.co.ke", "www.myjobmag.co.ke"],
  applicationType: "form",
  applyFlowNote:
    'User opens job listing → applies via dedicated URL myjobmag.co.ke/job-application/{id}. Page title: "Send Your Application". Submit via orange "Send Application" button after completing reCAPTCHA.',
  fields: [
    {
      id: "full_name",
      label: "Full Name",
      type: "text",
      required: true,
      source: "profile",
      profileKey: "full_name",
    },
    {
      id: "email_address",
      label: "Email Address",
      type: "text",
      required: true,
      source: "profile",
      profileKey: "email",
    },
    {
      id: "phone_number",
      label: "Phone Number",
      type: "text",
      required: true,
      source: "profile",
      profileKey: "phone",
      hint: "Kenyan format preferred, e.g. +2547XXXXXXXX or 07XXXXXXXX.",
    },
    {
      id: "years_experience",
      label: "How many years experience do you have ?",
      type: "select",
      required: true,
      source: "generated",
      options: [
        "No Experience",
        "1 year",
        "2 years",
        "3 years",
        "4 years",
        "5 years",
        "6-10 years",
        "11-15 years",
        "16+ years",
      ],
      hint:
        "Pick the closest option from the site dropdown based on work history. Match exact wording shown on MyJobMag when possible.",
    },
    {
      id: "current_location",
      label: "Where do you live currently?",
      type: "select",
      required: true,
      source: "profile",
      profileKey: "preferred_county",
      hint:
        "Kenyan city or county (e.g. Nairobi, Mombasa, Kisumu, Nakuru). Use profile preferred_county; if missing, infer from job location or current_address.",
    },
    {
      id: "cover_letter",
      label: "Your cover letter",
      type: "textarea",
      required: true,
      source: "generated",
      hint:
        'Professional cover letter tailored to the job (~200–350 words). Conversational but polished — this field placeholder says "Sell yourself here".',
    },
    {
      id: "cv_selection",
      label: "Select your CV",
      type: "select",
      required: false,
      source: "static",
      staticValue:
        "If logged into MyJobMag with a saved CV, select it from the dropdown; otherwise use attach new CV below.",
      hint: "Some application pages show this dropdown instead of file upload only.",
    },
    {
      id: "attach_cv",
      label: "Attach your CV (PDF or Word Document only. Max size: 2MB)",
      type: "file",
      required: true,
      source: "static",
      staticValue: "Attach CV from Tellus profile (PDF or Word, max 2MB).",
      hint: "User uploads manually in browser when not using saved MyJobMag CV.",
    },
    {
      id: "recaptcha",
      label: "reCAPTCHA",
      type: "text",
      required: true,
      source: "static",
      staticValue: "Complete manually in the browser — cannot be automated.",
    },
  ],
  formResponseTemplate: `MYJOBMAG APPLICATION FORM RULES

You are filling the MyJobMag Kenya "Send Your Application" form.

General:
- Use Kenyan English, clear and direct.
- Full name, email, and phone must match the candidate profile exactly when available.
- For dropdowns, return ONLY the chosen option text (no explanation).
- Cover letter: full paragraphs, not bullets; sell strengths for this specific role.
- CV: remind user to select saved CV OR attach PDF/Word ≤2MB from profile.
- reCAPTCHA: always answer "Complete manually in the browser".

Experience dropdown:
- Infer years from work history; pick closest listed option.

Location dropdown:
- Use Kenyan city/county; prefer profile preferred_county.

Return questions_and_answers with the EXACT field labels from the site profile, in the same order.`,
};
