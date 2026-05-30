-- Migration: Schedule the process-scrapy-jobs Edge Function to run every 10 minutes.
-- Created at 2026-05-28 by Antigravity

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.invoke_process_scrapy_jobs_edge()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  auth_token text;
  req_id bigint;
BEGIN
  SELECT decrypted_secret INTO auth_token
  FROM vault.decrypted_secrets
  WHERE name = 'scrape_cron_auth'
  LIMIT 1;

  IF auth_token IS NULL OR btrim(auth_token) = '' THEN
    RAISE WARNING 'scrape_cron_auth missing in Vault — process-scrapy-jobs skipped.';
    RETURN;
  END IF;

  SELECT net.http_post(
    url := 'https://eqkctzjyqmafpytvdepf.supabase.co/functions/v1/process-scrapy-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || btrim(auth_token),
      'apikey', btrim(auth_token)
    ),
    body := '{}'::jsonb
  ) INTO req_id;

  RAISE LOG 'process-scrapy-jobs cron queued, request_id=%', req_id;
END;
$$;

COMMENT ON FUNCTION public.invoke_process_scrapy_jobs_edge() IS
  'POST the process-scrapy-jobs edge function. Vault scrape_cron_auth = CRON_SECRET.';

-- Remove old cron job if present to be idempotent
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'process-scrapy-jobs-every-10m';

-- Schedule the Edge Function to run every 10 minutes (*/10 * * * *)
SELECT cron.schedule(
  'process-scrapy-jobs-every-10m',
  '*/10 * * * *',
  $$SELECT public.invoke_process_scrapy_jobs_edge();$$
);
