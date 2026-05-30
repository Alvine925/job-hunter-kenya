-- Add tailored_cv column to the applications table to store the job-tailored resume text
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS tailored_cv TEXT;
