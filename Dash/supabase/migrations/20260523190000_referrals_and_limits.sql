-- 1. Helper function to generate a unique 6-character alphanumeric referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    -- Ensure uniqueness in public.profiles
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = result) THEN
      RETURN result;
    END IF;
  END LOOP;
END;
$$;

-- 2. Extend public.profiles with referral and plan columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS current_plan TEXT NOT NULL DEFAULT 'free',
ADD COLUMN IF NOT EXISTS upgrade_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS active_referrals INTEGER DEFAULT 0;

-- Backfill referral codes for existing profiles
UPDATE public.profiles
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;

-- 3. Create public.referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  referral_code_used TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'rejected', 'flagged'
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals read policy" ON public.referrals 
  FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- 4. Create public.usage_tracking table
CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'cv_upload', 'pack_generation'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_tracking select policy" ON public.usage_tracking 
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_lookup 
ON public.usage_tracking (user_id, action_type, created_at);

-- 5. Trigger to handle referrals and code generation during profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref_code_used TEXT;
  referrer_id UUID;
BEGIN
  -- Read referral code from user metadata if provided during signup
  ref_code_used := NEW.raw_user_meta_data->>'ref';
  
  -- Find referrer
  IF ref_code_used IS NOT NULL THEN
    SELECT id INTO referrer_id FROM public.profiles WHERE referral_code = ref_code_used;
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name, referral_code, referred_by)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    public.generate_referral_code(),
    referrer_id
  )
  ON CONFLICT (id) DO NOTHING;

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

-- 6. Trigger to verify referrals when auth.users is confirmed/verified
CREATE OR REPLACE FUNCTION public.handle_auth_user_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Detect when a user gets email verified/confirmed
  IF (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL) 
     OR (OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL) THEN
     
    -- Update the referral status to 'completed'
    UPDATE public.referrals
    SET status = 'completed', verified_at = now()
    WHERE referred_user_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_update();

-- 7. Trigger BEFORE INSERT on referrals to auto-complete if email is already verified (OAuth/passwordless bypass)
CREATE OR REPLACE FUNCTION public.handle_new_referral_check()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_confirmed BOOLEAN;
BEGIN
  SELECT (email_confirmed_at IS NOT NULL OR confirmed_at IS NOT NULL) INTO is_confirmed
  FROM auth.users WHERE id = NEW.referred_user_id;

  IF is_confirmed THEN
    NEW.status := 'completed';
    NEW.verified_at := now();
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_new_referral ON public.referrals;
CREATE TRIGGER on_new_referral
BEFORE INSERT ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.handle_new_referral_check();

-- 8. Trigger to reward referrer when referral becomes completed
CREATE OR REPLACE FUNCTION public.process_completed_referral()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  referrer_profile public.profiles%ROWTYPE;
  new_active_count INTEGER;
  cycles INTEGER;
BEGIN
  -- Act when referral status transitions to completed
  IF (TG_OP = 'INSERT' AND NEW.status = 'completed') 
     OR (TG_OP = 'UPDATE' AND OLD.status != 'completed' AND NEW.status = 'completed') THEN
     
    SELECT * INTO referrer_profile FROM public.profiles WHERE id = NEW.referrer_user_id;
    
    IF referrer_profile.id IS NOT NULL THEN
      new_active_count := COALESCE(referrer_profile.active_referrals, 0) + 1;
      
      -- If they hit the 10-referrals upgrade mark
      IF new_active_count >= 10 THEN
        cycles := new_active_count / 10;
        new_active_count := new_active_count % 10;
        
        UPDATE public.profiles
        SET 
          current_plan = 'upgraded',
          upgrade_expires_at = COALESCE(
            CASE WHEN upgrade_expires_at > now() THEN upgrade_expires_at ELSE now() END,
            now()
          ) + (cycles * INTERVAL '30 days'),
          total_referrals = COALESCE(total_referrals, 0) + 1,
          active_referrals = new_active_count
        WHERE id = NEW.referrer_user_id;
      ELSE
        UPDATE public.profiles
        SET 
          total_referrals = COALESCE(total_referrals, 0) + 1,
          active_referrals = new_active_count
        WHERE id = NEW.referrer_user_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_referral_completed ON public.referrals;
CREATE TRIGGER on_referral_completed
AFTER INSERT OR UPDATE ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.process_completed_referral();

-- 9. Main check user limits function (handles lazy downgrade automatically)
CREATE OR REPLACE FUNCTION public.check_user_limits(
  p_user_id UUID,
  p_action_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_expires TIMESTAMPTZ;
  v_allowed BOOLEAN := true;
  v_reason TEXT := '';
  v_count INTEGER;
  v_limit INTEGER;
  v_last_time TIMESTAMPTZ;
  v_cooldown_mins INTEGER := 10;
BEGIN
  -- Get plan type
  SELECT current_plan, upgrade_expires_at INTO v_plan, v_expires
  FROM public.profiles WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'User profile not found');
  END IF;

  -- Lazy downgrade if expired
  IF v_plan = 'upgraded' AND v_expires < now() THEN
    UPDATE public.profiles
    SET current_plan = 'free', upgrade_expires_at = NULL
    WHERE id = p_user_id;
    v_plan := 'free';
    v_expires := NULL;
  END IF;

  -- Check CV Upload Limits
  IF p_action_type = 'cv_upload' THEN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.usage_tracking
    WHERE user_id = p_user_id
      AND action_type = 'cv_upload'
      AND created_at >= date_trunc('month', now());

    v_limit := CASE WHEN v_plan = 'upgraded' THEN 4 ELSE 2 END;

    IF v_count >= v_limit THEN
      v_allowed := false;
      v_reason := 'Monthly CV upload limit of ' || v_limit || ' reached. Invite friends to unlock more uploads!';
    END IF;

  -- Check Pack Generation Limits
  ELSIF p_action_type = 'pack_generation' THEN
    -- Check Cooldown (10 minutes)
    SELECT created_at INTO v_last_time
    FROM public.usage_tracking
    WHERE user_id = p_user_id
      AND action_type = 'pack_generation'
      ORDER BY created_at DESC
      LIMIT 1;

    IF v_last_time IS NOT NULL AND v_last_time > (now() - (v_cooldown_mins * INTERVAL '1 minute')) THEN
      v_allowed := false;
      v_reason := 'Cooldown active. Please wait ' || CEIL(extract(epoch from (v_last_time + (v_cooldown_mins * INTERVAL '1 minute') - now())) / 60) || ' more minute(s) before generating another pack.';
      RETURN jsonb_build_object('allowed', v_allowed, 'reason', v_reason);
    END IF;

    -- Check Daily Limit
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.usage_tracking
    WHERE user_id = p_user_id
      AND action_type = 'pack_generation'
      AND created_at >= date_trunc('day', now());

    v_limit := CASE WHEN v_plan = 'upgraded' THEN 4 ELSE 2 END;

    IF v_count >= v_limit THEN
      v_allowed := false;
      v_reason := 'Daily pack generation limit reached. Try again tomorrow or refer friends to unlock upgraded limits!';
      RETURN jsonb_build_object('allowed', v_allowed, 'reason', v_reason);
    END IF;

    -- Check Weekly Limit
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.usage_tracking
    WHERE user_id = p_user_id
      AND action_type = 'pack_generation'
      AND created_at >= date_trunc('week', now());

    v_limit := 10;

    IF v_count >= v_limit THEN
      v_allowed := false;
      v_reason := 'Weekly pack generation limit of 10 reached. Try again next week.';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'reason', v_reason,
    'plan', v_plan,
    'upgrade_expires_at', v_expires,
    'usage_count', v_count,
    'limit_count', v_limit
  );
END;
$$;

-- 10. Helper function to record usage logs
CREATE OR REPLACE FUNCTION public.track_user_usage(
  p_user_id UUID,
  p_action_type TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usage_tracking (user_id, action_type, metadata)
  VALUES (p_user_id, p_action_type, p_metadata);
END;
$$;
