-- Migration: Add email sending rate limiting to check_user_limits function

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

  -- Check Email Send Limits
  ELSIF p_action_type = 'email_send' THEN
    -- Check Daily Limit
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.usage_tracking
    WHERE user_id = p_user_id
      AND action_type = 'email_send'
      AND created_at >= date_trunc('day', now());

    v_limit := CASE WHEN v_plan = 'upgraded' THEN 20 ELSE 10 END;

    IF v_count >= v_limit THEN
      v_allowed := false;
      v_reason := 'Daily email sending limit of ' || v_limit || ' reached. Try again tomorrow.';
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
