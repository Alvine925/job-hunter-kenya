-- Fix: scraped_jobs may exist from a partial run without all columns (e.g. missing "source").

CREATE TABLE IF NOT EXISTS public.scraped_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.scraped_jobs SET source = 'Unknown' WHERE source IS NULL OR source = '';
UPDATE public.scraped_jobs SET application_method = 'unknown' WHERE application_method IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scraped_jobs_source_url_unique'
  ) THEN
    ALTER TABLE public.scraped_jobs
      ADD CONSTRAINT scraped_jobs_source_url_unique UNIQUE (source_url);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS scraped_jobs_source_idx ON public.scraped_jobs (source);
CREATE INDEX IF NOT EXISTS scraped_jobs_scraped_at_idx ON public.scraped_jobs (scraped_at DESC);
CREATE INDEX IF NOT EXISTS scraped_jobs_title_idx
  ON public.scraped_jobs USING gin (to_tsvector('english', coalesce(title, '')));

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
