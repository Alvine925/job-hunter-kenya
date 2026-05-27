-- Migration: Wire email notification Edge Functions via pg_net HTTP triggers
-- Fires on new profile inserts (welcome + admin notification) and new referral inserts (referral notification)

-- 1. Enable pg_net extension (required for async HTTP calls from Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Trigger function: fires welcome-email and signup-admin-notification on new profile insert
CREATE OR REPLACE FUNCTION public.trigger_signup_emails()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_url TEXT := 'https://eqkctzjyqmafpytvdepf.supabase.co';
  payload TEXT;
BEGIN
  -- Build JSON payload with the new profile record
  payload := json_build_object(
    'record', json_build_object(
      'id', NEW.id,
      'email', NEW.email,
      'full_name', NEW.full_name
    )
  )::text;

  -- Fire welcome email to user (async, non-blocking)
  PERFORM net.http_post(
    url := base_url || '/functions/v1/welcome-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'tellus_secret_webhook_token_2026'
    ),
    body := payload::jsonb
  );

  -- Fire admin signup notification (async, non-blocking)
  PERFORM net.http_post(
    url := base_url || '/functions/v1/signup-admin-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'tellus_secret_webhook_token_2026'
    ),
    body := payload::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block signups due to email failures
  RAISE WARNING 'trigger_signup_emails failed for user %: [%] %', NEW.id, SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$;

-- 3. Attach signup email trigger to profiles table (fires AFTER INSERT, once per new user)
DROP TRIGGER IF EXISTS on_profile_created_send_emails ON public.profiles;
CREATE TRIGGER on_profile_created_send_emails
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_signup_emails();

-- 4. Trigger function: fires referral-notification on new referral insert
CREATE OR REPLACE FUNCTION public.trigger_referral_emails()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_url TEXT := 'https://eqkctzjyqmafpytvdepf.supabase.co';
  payload TEXT;
BEGIN
  payload := json_build_object(
    'record', json_build_object(
      'referrer_user_id', NEW.referrer_user_id,
      'referred_user_id', NEW.referred_user_id,
      'referral_code_used', NEW.referral_code_used,
      'status', NEW.status
    )
  )::text;

  -- Fire referral notification (sends to both referrer and admin)
  PERFORM net.http_post(
    url := base_url || '/functions/v1/referral-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'tellus_secret_webhook_token_2026'
    ),
    body := payload::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block referral processing due to email failures
  RAISE WARNING 'trigger_referral_emails failed for referral %: [%] %', NEW.id, SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$;

-- 5. Attach referral email trigger to referrals table (fires AFTER INSERT)
DROP TRIGGER IF EXISTS on_referral_created_send_emails ON public.referrals;
CREATE TRIGGER on_referral_created_send_emails
  AFTER INSERT ON public.referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_referral_emails();
