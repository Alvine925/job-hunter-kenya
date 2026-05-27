-- Migration: Fix error_reports RLS policies
-- Drop permissive anonymous insert policy and replace with authenticated-only own user policy

DROP POLICY IF EXISTS "Allow anonymous and authenticated insert" ON public.error_reports;

CREATE POLICY "Allow authenticated insert of own reports"
  ON public.error_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
