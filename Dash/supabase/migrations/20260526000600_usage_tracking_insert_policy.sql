-- Migration: Add INSERT policy to usage_tracking table
-- Allows authenticated users to write their own usage events via PostgREST if needed

CREATE POLICY "Allow authenticated insert of own usage"
  ON public.usage_tracking FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
