-- Migration: Harden handle_new_user trigger to reliably capture referrals
-- Fixes:
--   1. ON CONFLICT clause now also updates referred_by (was silently ignored on conflict)
--   2. EXCEPTION handler now RAISEs a WARNING so errors appear in Postgres logs
--   3. Re-creates the trigger explicitly to ensure it is active on prod
--   4. Empty-string ref codes are now ignored (treats "" same as NULL)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref_code_used TEXT;
  referrer_id UUID;
  is_email_provider BOOLEAN;
BEGIN
  -- Read referral code from user metadata; ignore empty strings
  ref_code_used := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'ref', '')), '');

  -- Find referrer's profile id
  IF ref_code_used IS NOT NULL THEN
    SELECT id INTO referrer_id
    FROM public.profiles
    WHERE referral_code = ref_code_used
    LIMIT 1;
  END IF;

  is_email_provider := (
    NEW.raw_app_meta_data->>'provider' = 'email'
    OR (NEW.raw_app_meta_data->'providers')::jsonb ? 'email'
  );

  -- Upsert profile; on conflict also capture referred_by if not already set
  INSERT INTO public.profiles (id, email, full_name, referral_code, referred_by, has_set_password)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
    public.generate_referral_code(),
    referrer_id,
    is_email_provider
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email            = EXCLUDED.email,
    full_name        = COALESCE(profiles.full_name, EXCLUDED.full_name),
    referred_by      = COALESCE(profiles.referred_by, EXCLUDED.referred_by),
    has_set_password = COALESCE(profiles.has_set_password, EXCLUDED.has_set_password);

  -- Record a pending referral if a valid referrer was found
  IF referrer_id IS NOT NULL AND referrer_id != NEW.id THEN
    INSERT INTO public.referrals (referrer_user_id, referred_user_id, referral_code_used, status)
    VALUES (referrer_id, NEW.id, ref_code_used, 'pending')
    ON CONFLICT (referred_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error instead of silently swallowing it
  RAISE WARNING 'handle_new_user failed for user % (email: %): [%] %',
    NEW.id, NEW.email, SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists on auth.users (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: create pending referral entries for any existing users who signed
-- up with a ref code stored in their profile (referred_by IS NOT NULL) but
-- whose referral row was never created.
INSERT INTO public.referrals (referrer_user_id, referred_user_id, referral_code_used, status)
SELECT
  p.referred_by,
  p.id,
  ref_profile.referral_code,
  CASE
    WHEN u.email_confirmed_at IS NOT NULL OR u.confirmed_at IS NOT NULL
    THEN 'completed'
    ELSE 'pending'
  END
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
JOIN public.profiles ref_profile ON ref_profile.id = p.referred_by
WHERE p.referred_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.referrals r WHERE r.referred_user_id = p.id
  )
ON CONFLICT (referred_user_id) DO NOTHING;

-- Backfill: update referrer stats for any completed referrals that were missed
UPDATE public.profiles p
SET
  total_referrals = sub.completed_count,
  active_referrals = sub.completed_count % 10,
  current_plan = CASE WHEN sub.completed_count >= 10 THEN 'upgraded' ELSE p.current_plan END,
  upgrade_expires_at = CASE
    WHEN sub.completed_count >= 10 AND (p.upgrade_expires_at IS NULL OR p.upgrade_expires_at < now())
    THEN now() + ((sub.completed_count / 10) * INTERVAL '30 days')
    ELSE p.upgrade_expires_at
  END
FROM (
  SELECT referrer_user_id, COUNT(*) AS completed_count
  FROM public.referrals
  WHERE status = 'completed'
  GROUP BY referrer_user_id
) sub
WHERE p.id = sub.referrer_user_id
  AND (p.total_referrals IS DISTINCT FROM sub.completed_count);
