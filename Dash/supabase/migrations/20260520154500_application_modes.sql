ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS application_mode TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS application_mode TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS application_email TEXT,
  ADD COLUMN IF NOT EXISTS application_url TEXT,
  ADD COLUMN IF NOT EXISTS automation_error TEXT,
  ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_via TEXT;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS application_method TEXT NOT NULL DEFAULT 'unknown';

CREATE UNIQUE INDEX IF NOT EXISTS jobs_user_source_url_unique
  ON public.jobs (user_id, source_url);

CREATE TABLE IF NOT EXISTS public.user_integrations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_connected BOOLEAN NOT NULL DEFAULT false,
  google_scopes TEXT[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_integrations'
      AND policyname = 'own integrations all'
  ) THEN
    CREATE POLICY "own integrations all"
      ON public.user_integrations
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS user_integrations_touch ON public.user_integrations;
CREATE TRIGGER user_integrations_touch
BEFORE UPDATE ON public.user_integrations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
