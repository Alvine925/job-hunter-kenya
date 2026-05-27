-- Migration: Create notifications table and triggers for applications/referrals
-- Created at 2026-05-25 by Antigravity

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'application_sent', 'referral_signup', 'application_failed'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications select" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "own notifications update" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own notifications delete" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "own notifications insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, read, created_at DESC);

-- Trigger for referrals
CREATE OR REPLACE FUNCTION public.on_referral_completed_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  referee_name TEXT;
BEGIN
  -- Get referee's name/email
  SELECT COALESCE(full_name, email, 'Someone') INTO referee_name
  FROM public.profiles
  WHERE id = NEW.referred_user_id;

  -- Trigger on INSERT (pending signup)
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.referrer_user_id,
      'referral_signup',
      'New Referral Sign-up! 👥',
      referee_name || ' signed up using your referral code (pending email verification).',
      jsonb_build_object('referred_user_id', NEW.referred_user_id, 'status', NEW.status)
    );
  END IF;

  -- Trigger on UPDATE to completed
  IF (TG_OP = 'UPDATE' AND OLD.status != 'completed' AND NEW.status = 'completed') THEN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.referrer_user_id,
      'referral_signup',
      'Referral Verified! 💎',
      referee_name || ' verified their email. Your referral is now active!',
      jsonb_build_object('referred_user_id', NEW.referred_user_id, 'status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_referral_completed_notify ON public.referrals;
CREATE TRIGGER on_referral_completed_notify
AFTER INSERT OR UPDATE ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.on_referral_completed_notify();

-- Trigger for applications
CREATE OR REPLACE FUNCTION public.on_application_status_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Application sent successfully
  IF (TG_OP = 'UPDATE' AND OLD.status != 'sent' AND NEW.status = 'sent')
     OR (TG_OP = 'INSERT' AND NEW.status = 'sent') THEN
    
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.user_id,
      'application_sent',
      'Application Sent! 🚀',
      'Your application for "' || NEW.job_title || '" at ' || COALESCE(NEW.company, 'employer') || ' was sent.',
      jsonb_build_object('application_id', NEW.id, 'job_title', NEW.job_title, 'company', NEW.company)
    );
  END IF;

  -- Application failed with error
  IF (TG_OP = 'UPDATE' AND NEW.status = 'failed' AND OLD.status != 'failed')
     OR (TG_OP = 'INSERT' AND NEW.status = 'failed')
     OR (NEW.automation_error IS NOT NULL AND (OLD.automation_error IS NULL OR OLD.automation_error != NEW.automation_error)) THEN
    
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.user_id,
      'application_failed',
      'Auto-Apply Failed ⚠️',
      'Failed to apply for "' || NEW.job_title || '": ' || COALESCE(NEW.automation_error, 'Unknown error'),
      jsonb_build_object('application_id', NEW.id, 'job_title', NEW.job_title, 'error', NEW.automation_error)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_application_status_notify ON public.applications;
CREATE TRIGGER on_application_status_notify
AFTER INSERT OR UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.on_application_status_notify();
