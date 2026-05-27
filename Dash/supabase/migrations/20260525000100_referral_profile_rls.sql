-- Migration: Allow referrers to read basic profile info of users they referred
-- Without this, the settings page can't fetch referred users' names/emails
-- because the existing RLS policy only allows auth.uid() = id reads.

CREATE POLICY "referrer can read referred user profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.referrals
      WHERE referrals.referrer_user_id = auth.uid()
        AND referrals.referred_user_id = profiles.id
    )
  );
