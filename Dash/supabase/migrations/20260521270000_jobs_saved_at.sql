-- Bookmarked jobs (Save button on job detail).
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS jobs_user_saved_at_idx
  ON public.jobs (user_id, saved_at DESC)
  WHERE saved_at IS NOT NULL;
