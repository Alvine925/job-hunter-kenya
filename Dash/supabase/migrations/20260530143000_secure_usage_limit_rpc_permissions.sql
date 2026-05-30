-- Allow authenticated app users and user-scoped Edge Functions to call usage limit RPCs.
-- The functions are SECURITY DEFINER because they read limit tables behind RLS, so each
-- function also verifies that callers can only operate on their own user id.

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
  IF auth.role() <> 'service_role' AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Unauthorized limit check');
  END IF;

  SELECT current_plan, upgrade_expires_at INTO v_plan, v_expires
  FROM public.profiles WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'User profile not found');
  END IF;

  IF v_plan = 'upgraded' AND v_expires < now() THEN
    UPDATE public.profiles
    SET current_plan = 'free', upgrade_expires_at = NULL
    WHERE id = p_user_id;
    v_plan := 'free';
    v_expires := NULL;
  END IF;

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

  ELSIF p_action_type = 'pack_generation' THEN
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

  ELSIF p_action_type = 'email_send' THEN
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

  ELSIF p_action_type = 'job_coach_chat' THEN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.usage_tracking
    WHERE user_id = p_user_id
      AND action_type = 'job_coach_chat'
      AND created_at >= date_trunc('day', now());

    v_limit := CASE WHEN v_plan = 'upgraded' THEN 100 ELSE 50 END;

    IF v_count >= v_limit THEN
      v_allowed := false;
      v_reason := 'Daily AI Job Coach chat message limit of ' || v_limit || ' reached. Try again tomorrow.';
    END IF;

  ELSIF p_action_type = 'interview_answer' THEN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.usage_tracking
    WHERE user_id = p_user_id
      AND action_type = 'interview_answer'
      AND created_at >= date_trunc('day', now());

    v_limit := CASE WHEN v_plan = 'upgraded' THEN 60 ELSE 30 END;

    IF v_count >= v_limit THEN
      v_allowed := false;
      v_reason := 'Daily AI Interview answers submission limit of ' || v_limit || ' reached. Try again tomorrow.';
    END IF;

  ELSIF p_action_type = 'job_scrape' THEN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.usage_tracking
    WHERE user_id = p_user_id
      AND action_type = 'job_scrape'
      AND created_at >= date_trunc('day', now());

    v_limit := CASE WHEN v_plan = 'upgraded' THEN 15 ELSE 5 END;

    IF v_count >= v_limit THEN
      v_allowed := false;
      v_reason := 'Daily manual job search scraping limit of ' || v_limit || ' reached. Try again tomorrow.';
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
  IF auth.role() <> 'service_role' AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized usage tracking' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.usage_tracking (user_id, action_type, metadata)
  VALUES (p_user_id, p_action_type, p_metadata);
END;
$$;

REVOKE ALL ON FUNCTION public.check_user_limits(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_user_usage(UUID, TEXT, JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.check_user_limits(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_limits(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.track_user_usage(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_user_usage(UUID, TEXT, JSONB) TO service_role;
