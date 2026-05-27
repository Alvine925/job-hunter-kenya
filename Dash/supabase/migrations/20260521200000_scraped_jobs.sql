-- Shared catalog of jobs scraped daily from job boards (ScrapingBee).
-- Use 20260521220000_fix_scraped_jobs_columns.sql if table already existed without "source".

CREATE TABLE IF NOT EXISTS public.scraped_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'Unknown',
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  county TEXT,
  description TEXT,
  description_summary TEXT,
  requirements TEXT,
  responsibilities TEXT,
  job_type TEXT,
  work_type TEXT,
  salary_text TEXT,
  application_url TEXT,
  application_email TEXT,
  application_method TEXT NOT NULL DEFAULT 'unknown',
  contact_person TEXT,
  contact_phone TEXT,
  deadline DATE,
  deadline_text TEXT,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scraped_jobs_source_url_unique UNIQUE (source_url)
);

-- Idempotent column adds when table pre-existed with fewer columns
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS county TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS description_summary TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS requirements TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS responsibilities TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS job_type TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS work_type TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS salary_text TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS application_url TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS application_email TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS application_method TEXT DEFAULT 'unknown';
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS deadline_text TEXT;

UPDATE public.scraped_jobs SET source = 'Unknown' WHERE source IS NULL OR source = '';

CREATE INDEX IF NOT EXISTS scraped_jobs_source_idx ON public.scraped_jobs (source);
CREATE INDEX IF NOT EXISTS scraped_jobs_scraped_at_idx ON public.scraped_jobs (scraped_at DESC);
CREATE INDEX IF NOT EXISTS scraped_jobs_title_idx ON public.scraped_jobs USING gin (to_tsvector('english', coalesce(title, '')));

ALTER TABLE public.scraped_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scraped_jobs' AND policyname = 'authenticated read scraped jobs'
  ) THEN
    CREATE POLICY "authenticated read scraped jobs"
      ON public.scraped_jobs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS scraped_jobs_touch ON public.scraped_jobs;
CREATE TRIGGER scraped_jobs_touch
BEFORE UPDATE ON public.scraped_jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
