-- Default form_response template tuned for BrighterMonday apply modal
INSERT INTO public.templates (user_id, name, type, category, tone, content, is_default)
SELECT
  p.id,
  'BrighterMonday form responses' AS name,
  'form_response' AS type,
  'BrighterMonday' AS category,
  'Formal' AS tone,
  'BRIGHTERMONDAY APPLICATION FORM RULES

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

Return questions_and_answers with the EXACT field labels from the site profile, in the same order.' AS content,
  false AS is_default
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.templates t
  WHERE t.user_id = p.id AND t.type = 'form_response'
);
