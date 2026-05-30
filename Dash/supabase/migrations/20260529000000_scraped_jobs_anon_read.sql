-- Allow anonymous (unauthenticated) users to read scraped_jobs
-- so the public marketplace page can display job listings to guests.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scraped_jobs' AND policyname = 'anon read scraped jobs'
  ) THEN
    CREATE POLICY "anon read scraped jobs"
      ON public.scraped_jobs FOR SELECT TO anon USING (true);
  END IF;
END $$;
