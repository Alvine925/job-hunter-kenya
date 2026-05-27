-- Migration: Create error_reports table for tracking and debugging client/server errors.
-- Created at 2026-05-25 by Antigravity

CREATE TABLE IF NOT EXISTS public.error_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  section TEXT,
  action_context TEXT,
  user_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

-- Index for querying/sorting
CREATE INDEX IF NOT EXISTS error_reports_created_at_idx ON public.error_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS error_reports_user_id_idx ON public.error_reports (user_id);

-- RLS Policies
-- Allow anyone to insert error reports (authenticated or anonymous)
CREATE POLICY "Allow anonymous and authenticated insert"
  ON public.error_reports FOR INSERT
  WITH CHECK (true);

-- Allow users to view their own reports
CREATE POLICY "Allow users to select their own reports"
  ON public.error_reports FOR SELECT
  USING (auth.uid() = user_id);
