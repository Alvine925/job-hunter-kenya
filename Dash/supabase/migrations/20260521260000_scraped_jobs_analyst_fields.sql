-- AI analyst fields for scraped_jobs (company + role narratives, metadata).

ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS company_summary TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS role_description TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS experience_level TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS education_level TEXT;
