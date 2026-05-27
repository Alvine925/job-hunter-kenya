ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS interview_session TEXT,
  ADD COLUMN IF NOT EXISTS interview_report TEXT;
