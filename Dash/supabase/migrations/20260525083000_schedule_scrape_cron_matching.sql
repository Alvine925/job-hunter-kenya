-- Schedule the matching engine (scrape-cron) at 08:30 EAT (05:30 UTC) daily.
-- Runs 30 min after the board scrapers finish so new listings are already in the catalog.
--
-- Prerequisite: scrape_cron_auth must be set in Vault (same secret as CRON_SECRET).
-- Run scripts/setup-scrape-cron-vault.sql if not already done.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.invoke_match_engine_edge()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  auth_token text;
  req_id     bigint;
BEGIN
  SELECT decrypted_secret INTO auth_token
  FROM vault.decrypted_secrets
  WHERE name = 'scrape_cron_auth'
  LIMIT 1;

  IF auth_token IS NULL OR btrim(auth_token) = '' THEN
    RAISE WARNING 'scrape_cron_auth missing in Vault — scrape-cron skipped. Run scripts/setup-scrape-cron-vault.sql';
    RETURN;
  END IF;

  SELECT net.http_post(
    url     := 'https://eqkctzjyqmafpytvdepf.supabase.co/functions/v1/scrape-cron',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || btrim(auth_token),
      'apikey',        btrim(auth_token)
    ),
    body    := '{}'::jsonb
  ) INTO req_id;

  RAISE LOG 'scrape-cron (matching engine) cron queued, request_id=%', req_id;
END;
$$;

COMMENT ON FUNCTION public.invoke_match_engine_edge() IS
  'Triggers the scrape-cron matching engine edge function. Vault scrape_cron_auth = CRON_SECRET.';

-- Remove stale job name if exists
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'scrape-cron-match-830am-eat';

-- 08:30 EAT (05:30 UTC) daily — after board scrapers have populated the catalog
SELECT cron.schedule(
  'scrape-cron-match-830am-eat',
  '30 5 * * *',
  $$SELECT public.invoke_match_engine_edge();$$
);
