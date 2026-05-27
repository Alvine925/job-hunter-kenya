-- Daily new job scrapers at 07:00 East Africa Time (04:00 UTC) and 07:10 EAT (04:10 UTC).
-- Schedules the new SerpAPI and Apify edge functions.
--
-- One-time Vault setup: scripts/setup-scrape-cron-vault.sql
-- (scrape_cron_auth must match Edge secret CRON_SECRET)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.invoke_new_site_scraper_edge(
  p_function text,
  p_limit int DEFAULT 8
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  auth_token text;
  req_id bigint;
  fn text;
BEGIN
  fn := btrim(p_function);
  IF fn !~ '^scrape-(serpapi-google-jobs|linkedin-apify)$' THEN
    RAISE EXCEPTION 'Invalid new scraper function: %', fn;
  END IF;

  SELECT decrypted_secret INTO auth_token
  FROM vault.decrypted_secrets
  WHERE name = 'scrape_cron_auth'
  LIMIT 1;

  IF auth_token IS NULL OR btrim(auth_token) = '' THEN
    RAISE WARNING 'scrape_cron_auth missing in Vault — % skipped. Run scripts/setup-scrape-cron-vault.sql', fn;
    RETURN;
  END IF;

  SELECT net.http_post(
    url := 'https://eqkctzjyqmafpytvdepf.supabase.co/functions/v1/'
      || fn
      || '?limit='
      || greatest(1, least(50, coalesce(p_limit, 8))),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || btrim(auth_token),
      'apikey', btrim(auth_token)
    ),
    body := '{}'::jsonb
  ) INTO req_id;

  RAISE LOG '% cron queued, request_id=%', fn, req_id;
END;
$$;

COMMENT ON FUNCTION public.invoke_new_site_scraper_edge(text, int) IS
  'POST a new site scraper edge function. Vault scrape_cron_auth = CRON_SECRET.';

-- Remove old cron jobs if present to be idempotent
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'scrape-serpapi-google-jobs-7am-eat',
  'scrape-linkedin-apify-7am-eat'
);

-- Schedule new scrapers
-- 07:00 AM EAT (04:00 UTC) for SerpAPI Google Jobs
SELECT cron.schedule(
  'scrape-serpapi-google-jobs-7am-eat',
  '0 4 * * *',
  $$SELECT public.invoke_new_site_scraper_edge('scrape-serpapi-google-jobs', 8);$$
);

-- 07:10 AM EAT (04:10 UTC) for LinkedIn Apify (staggered by 10 minutes)
SELECT cron.schedule(
  'scrape-linkedin-apify-7am-eat',
  '10 4 * * *',
  $$SELECT public.invoke_new_site_scraper_edge('scrape-linkedin-apify', 5);$$
);
