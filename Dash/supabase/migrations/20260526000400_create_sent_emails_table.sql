-- Migration: Create sent_emails table for auditing email-sending activity
-- Enables Row Level Security so users can only view their own sent email history

CREATE TABLE IF NOT EXISTS public.sent_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_preview TEXT,
  gmail_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS sent_emails_user_id_idx ON public.sent_emails (user_id);
CREATE INDEX IF NOT EXISTS sent_emails_application_id_idx ON public.sent_emails (application_id);
CREATE INDEX IF NOT EXISTS sent_emails_created_at_idx ON public.sent_emails (created_at DESC);

-- Select policy
CREATE POLICY "Allow users to select their own sent emails"
  ON public.sent_emails FOR SELECT
  USING (auth.uid() = user_id);

-- Insert policy for authenticated users (to record their own sends)
CREATE POLICY "Allow authenticated users to insert their own sent emails"
  ON public.sent_emails FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
