CREATE TABLE IF NOT EXISTS public.job_coach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  similar_jobs JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_coach_messages_user_job_idx
  ON public.job_coach_messages (user_id, job_id, created_at);

ALTER TABLE public.job_coach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_coach_messages_select_own"
  ON public.job_coach_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "job_coach_messages_insert_own"
  ON public.job_coach_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "job_coach_messages_delete_own"
  ON public.job_coach_messages FOR DELETE
  USING (auth.uid() = user_id);
