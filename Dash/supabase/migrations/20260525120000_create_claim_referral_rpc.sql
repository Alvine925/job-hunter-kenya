-- Migration: Create claim_referral RPC function to capture referrals for both Google and Email signups.
-- Created at 2026-05-25 by Antigravity

CREATE OR REPLACE FUNCTION public.claim_referral(ref_code TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  referrer_id UUID;
  referee_id UUID;
BEGIN
  referee_id := auth.uid();
  IF referee_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Trim and ignore empty/null referral codes
  ref_code := NULLIF(TRIM(ref_code), '');
  IF ref_code IS NULL THEN
    RETURN;
  END IF;

  -- Find referrer's profile ID
  SELECT id INTO referrer_id
  FROM public.profiles
  WHERE referral_code = ref_code
  LIMIT 1;

  -- If no referrer found, or trying to refer oneself, do nothing
  IF referrer_id IS NULL OR referrer_id = referee_id THEN
    RETURN;
  END IF;

  -- Update referee's profile referred_by if not already set
  UPDATE public.profiles
  SET referred_by = COALESCE(profiles.referred_by, referrer_id)
  WHERE id = referee_id;

  -- Insert pending referral row
  -- (Trigger on_new_referral will automatically upgrade it to 'completed' if referee is already verified)
  INSERT INTO public.referrals (referrer_user_id, referred_user_id, referral_code_used, status)
  VALUES (referrer_id, referee_id, ref_code, 'pending')
  ON CONFLICT (referred_user_id) DO NOTHING;
END;
$$;
