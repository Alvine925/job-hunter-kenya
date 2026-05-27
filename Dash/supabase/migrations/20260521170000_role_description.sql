ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS role_description TEXT;

ALTER TABLE public.job_listings
  ADD COLUMN IF NOT EXISTS role_description TEXT;
