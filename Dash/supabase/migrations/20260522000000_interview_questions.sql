ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS interview_questions TEXT;

ALTER TABLE public.job_coach_messages
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'coach'
  CHECK (session_type IN ('coach', 'interview'));

CREATE INDEX IF NOT EXISTS job_coach_messages_user_job_session_idx
  ON public.job_coach_messages (user_id, job_id, session_type, created_at);
