-- Migration: Fix handle_new_user trigger to preserve has_set_password and correct ON CONFLICT
-- Created on 2026-05-23 by Antigravity

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref_code_used TEXT;
  referrer_id UUID;
  is_email_provider BOOLEAN;
BEGIN
  -- Read referral code from user metadata if provided during signup
  ref_code_used := NEW.raw_user_meta_data->>'ref';
  
  -- Find referrer
  IF ref_code_used IS NOT NULL THEN
    SELECT id INTO referrer_id FROM public.profiles WHERE referral_code = ref_code_used;
  END IF;

  is_email_provider := (
    NEW.raw_app_meta_data->>'provider' = 'email'
    OR (NEW.raw_app_meta_data->'providers')::jsonb ? 'email'
  );

  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name, referral_code, referred_by, has_set_password)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    public.generate_referral_code(),
    referrer_id,
    is_email_provider
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(profiles.full_name, EXCLUDED.full_name);

  -- If referred, create a pending referral entry
  IF referrer_id IS NOT NULL AND referrer_id != NEW.id THEN
    INSERT INTO public.referrals (referrer_user_id, referred_user_id, referral_code_used, status)
    VALUES (referrer_id, NEW.id, ref_code_used, 'pending')
    ON CONFLICT (referred_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Prevent database failures from blocking signups
  RETURN NEW;
END; $$;
