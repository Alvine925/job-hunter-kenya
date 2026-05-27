-- User-defined URLs/paths to monitor for job postings

CREATE TABLE IF NOT EXISTS public.job_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  scrape_frequency TEXT NOT NULL DEFAULT 'manual'
    CHECK (scrape_frequency IN ('manual', 'daily', 'weekly')),
  last_scraped_at TIMESTAMPTZ,
  last_scrape_status TEXT,
  last_scrape_error TEXT,
  last_jobs_found INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_monitors_user_id_idx ON public.job_monitors (user_id);
CREATE INDEX IF NOT EXISTS job_monitors_active_frequency_idx
  ON public.job_monitors (active, scrape_frequency, last_scraped_at)
  WHERE active = true;

ALTER TABLE public.job_monitors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_monitors' AND policyname = 'own job monitors all'
  ) THEN
    CREATE POLICY "own job monitors all"
      ON public.job_monitors
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS job_monitors_touch ON public.job_monitors;
CREATE TRIGGER job_monitors_touch
BEFORE UPDATE ON public.job_monitors
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
