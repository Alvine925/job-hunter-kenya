-- Shared job catalog: scraped once, reused across users. User jobs link via listing_id.

CREATE TABLE IF NOT EXISTS public.job_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  county TEXT,
  description TEXT,
  requirements TEXT,
  responsibilities TEXT,
  salary_text TEXT,
  job_type TEXT,
  source TEXT,
  application_email TEXT,
  application_url TEXT,
  application_method TEXT NOT NULL DEFAULT 'unknown',
  contact_person TEXT,
  contact_phone TEXT,
  deadline DATE,
  deadline_text TEXT,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT job_listings_source_url_unique UNIQUE (source_url)
);

CREATE INDEX IF NOT EXISTS job_listings_deadline_idx
  ON public.job_listings (deadline)
  WHERE deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS job_listings_source_idx ON public.job_listings (source);
CREATE INDEX IF NOT EXISTS job_listings_scraped_at_idx ON public.job_listings (scraped_at DESC);

ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_listings' AND policyname = 'authenticated read job listings'
  ) THEN
    CREATE POLICY "authenticated read job listings"
      ON public.job_listings FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS job_listings_touch ON public.job_listings;
CREATE TRIGGER job_listings_touch
BEFORE UPDATE ON public.job_listings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES public.job_listings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS jobs_listing_id_idx ON public.jobs (listing_id);

CREATE UNIQUE INDEX IF NOT EXISTS jobs_user_listing_unique
  ON public.jobs (user_id, listing_id)
  WHERE listing_id IS NOT NULL;
