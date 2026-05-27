-- Migration: Create pending_oauth_sessions table for secure OAuth token exchange
-- This replaces passing tokens in URL query parameters (CRITICAL security fix)
-- Sessions are single-use, expire after 5 minutes, cleaned up automatically

CREATE TABLE IF NOT EXISTS public.pending_oauth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token TEXT UNIQUE NOT NULL,
  code_verifier TEXT,
  ref_code TEXT,
  access_token TEXT,
  refresh_token TEXT,
  google_access_token TEXT,
  google_refresh_token TEXT,
  user_id UUID,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '5 minutes')
);

-- No RLS needed — this table is only accessed via service role in edge functions/server
ALTER TABLE public.pending_oauth_sessions ENABLE ROW LEVEL SECURITY;
-- No policies = no client access via PostgREST (service role only)

-- Index for fast lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_pending_oauth_state ON public.pending_oauth_sessions (state_token) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_pending_oauth_expires ON public.pending_oauth_sessions (expires_at);

-- Cleanup function: delete expired/used sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_sessions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.pending_oauth_sessions
  WHERE used = true OR expires_at < now();
END;
$$;
