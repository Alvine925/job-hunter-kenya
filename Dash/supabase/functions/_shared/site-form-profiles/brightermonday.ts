import type { SiteFormProfile } from "./types.ts";

/**
 * BrighterMonday Kenya — standard "Apply" modal form (logged-in user).
 * Fields captured from brightermonday.co.ke application UI, May 2026.
 */
export const brighterMondayProfile: SiteFormProfile = {
  id: "brightermonday",
  name: "BrighterMonday",
  domains: ["brightermonday.co.ke", "www.brightermonday.co.ke"],
  applicationType: "form",
  applyFlowNote:
    "User clicks Apply on a job listing → modal form opens. Name/email/phone usually come from the BrighterMonday account; this modal collects demographics, experience, salary, CV upload, and cover letter.",
  fields: [
    {
      id: "date_of_birth",
      label: "Date of birth",
      type: "date",
      required: true,
      source: "user_required",
      hint: "Format mm/dd/yyyy. Only answer if date of birth appears in the CV; otherwise respond: SET MANUALLY — not in profile.",
    },
    {
      id: "gender",
      label: "Gender",
      type: "radio",
      required: true,
      source: "user_required",
      options: ["Male", "Female"],
      hint: "Pick one option exactly as shown. If unknown, respond: SET MANUALLY.",
    },
    {
      id: "disabled",
      label: "Disabled",
      type: "radio",
      required: true,
      source: "static",
      options: ["Yes", "No"],
      staticValue: "No",
      hint: "Default No unless the candidate profile states otherwise.",
    },
    {
      id: "internally_displaced",
      label: "Internally displaced person",
      type: "radio",
      required: true,
      source: "static",
      options: ["Yes", "No"],
      staticValue: "No",
      hint: "Default No unless the candidate profile states otherwise.",
    },
    {
      id: "professional_headline",
      label: "Professional headline / title",
      type: "text",
      required: true,
      source: "generated",
      hint:
        "One line, e.g. 'Senior Software Engineer' or 'NGO Program Officer'. Derive from CV and target job title.",
    },
    {
      id: "years_of_experience",
      label: "Years of Experience",
      type: "searchable_select",
      required: true,
      source: "generated",
      options: [
        "No Experience/Less than 1 year",
        "1 year",
        "2 years",
        "3 years",
        "4 years",
        "5 years",
        "6-10 years",
        "11-15 years",
        "16+ years",
      ],
      hint: "Pick the closest option from the list based on work history. Use exact option text.",
    },
    {
      id: "function",
      label: "Function",
      type: "select",
      required: true,
      source: "generated",
      hint:
        "Select the job function/category that best matches the role (e.g. Sales, IT, Finance, HR, Admin). Use BrighterMonday-style function names when inferring from the job listing.",
    },
    {
      id: "work_type",
      label: "Work Type",
      type: "select",
      required: true,
      source: "job",
      options: ["Full Time", "Part Time", "Internship & Graduate", "Contract"],
      hint: "Map job_type from listing to one of these four options exactly.",
    },
    {
      id: "highest_qualification",
      label: "Highest Qualification",
      type: "select",
      required: true,
      source: "generated",
      options: [
        "Certificate",
        "Diploma",
        "Bachelor's Degree",
        "Master's Degree",
        "PhD",
        "Other",
      ],
      hint: "Infer from education section of CV. Use closest BrighterMonday qualification level.",
    },
    {
      id: "location",
      label: "Location",
      type: "searchable_select",
      required: true,
      source: "profile",
      profileKey: "preferred_county",
      hint:
        "Kenyan county or city where candidate is based (e.g. Nairobi, Mombasa, Nakuru, Thika, Kisumu). Match job location when candidate county unknown.",
    },
    {
      id: "availability",
      label: "Availability",
      type: "select",
      required: true,
      source: "generated",
      options: [
        "Immediately",
        "1 week",
        "2 weeks",
        "1 month",
        "2 months",
        "3+ months",
      ],
      hint: "Typical notice period; default to Immediately or 1 month if unclear.",
    },
    {
      id: "monthly_salary_expectation_gross",
      label: "Monthly Salary Expectation (Gross)",
      type: "currency",
      required: true,
      source: "generated",
      hint:
        "Currency is KSh. Give a single gross monthly figure in KES (digits only, no commas), aligned with job salary range and profile minimum_salary when set.",
    },
    {
      id: "cv_upload",
      label: "Upload your CV",
      type: "file",
      required: true,
      source: "static",
      staticValue: "Attach CV from Tellus profile (pdf, doc, docx, or rtf — max 10MB).",
      hint: "User uploads manually in browser; do not generate file content.",
    },
    {
      id: "cover_letter",
      label: "Cover letter",
      type: "textarea",
      required: true,
      source: "generated",
      hint: "Full tailored cover letter (~250–350 words) for this job.",
    },
  ],
  formResponseTemplate: `BRIGHTERMONDAY APPLICATION FORM RULES

You are filling the standard BrighterMonday Kenya apply modal. Return answers that can be copied directly into each field.

General:
- Use Kenyan English, professional tone.
- For radio/select fields, output ONLY one allowed option exactly as listed (no extra text).
- Salary is always gross monthly in KSh (Kenyan Shillings).
- Never invent date of birth or gender; if not in CV, say "SET MANUALLY".
- CV upload: remind user to attach profile CV (do not paste binary).

Field-specific:
- Professional headline: one line, role-focused.
- Years of Experience: pick closest dropdown option from the site list.
- Function: match the job department (Sales, IT, Finance, etc.).
- Work Type: map listing to Full Time | Part Time | Internship & Graduate | Contract.
- Highest Qualification: from CV education.
- Location: Kenyan county/city; prefer profile preferred_county, else job location.
- Availability: realistic notice period.
- Monthly Salary Expectation: numeric KES only in the amount field; respect job salary band when listed.
- Cover letter: complete letter, not bullet points.

Return questions_and_answers with the EXACT field labels from the site profile, in the same order.`,
};
