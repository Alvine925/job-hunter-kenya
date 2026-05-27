-- Short employer blurb for Company tab (not raw job-board scrape)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS company_summary TEXT;

ALTER TABLE public.job_listings
  ADD COLUMN IF NOT EXISTS company_summary TEXT;
