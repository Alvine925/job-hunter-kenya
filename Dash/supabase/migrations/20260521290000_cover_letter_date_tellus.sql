-- Existing cover letter templates stay as-is; drop only the [Date] line.
-- The generated letter date comes from the server (Africa/Nairobi), not the template.

UPDATE public.templates
SET content = regexp_replace(content, '^\[Date\]\s*\n+', '', 'i')
WHERE type = 'cover_letter'
  AND content ~* '\[Date\]';
