-- Daily board scrapers at 08:00 East Africa Time (05:00 UTC).
-- Schedules the 5 site edge functions (NOT scrape-all-sites, NOT scrape-cron).
--
-- One-time Vault setup: scripts/setup-scrape-cron-vault.sql
-- (scrape_cron_auth must match Edge secret CRON_SECRET)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.invoke_site_scraper_edge(
  p_function text,
  p_limit int DEFAULT 12
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
  IF fn !~ '^scrape-(fuzu|brightermonday|myjobmag|myjobsinkenya|linkedin)$' THEN
    RAISE EXCEPTION 'Invalid scraper function: %', fn;
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
      || greatest(1, least(50, coalesce(p_limit, 12))),
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

COMMENT ON FUNCTION public.invoke_site_scraper_edge(text, int) IS
  'POST one board scraper edge function. Vault scrape_cron_auth = CRON_SECRET.';

-- Remove wrong/old jobs if present
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'scrape-all-sites-8am-eat',
  'scrape-fuzu-8am-eat',
  'scrape-brightermonday-8am-eat',
  'scrape-myjobmag-8am-eat',
  'scrape-myjobsinkenya-8am-eat',
  'scrape-linkedin-8am-eat'
);

-- 08:00 EAT — all five board scrapers (staggered by 5 min to ease API load)
SELECT cron.schedule(
  'scrape-fuzu-8am-eat',
  '0 5 * * *',
  $$SELECT public.invoke_site_scraper_edge('scrape-fuzu', 12);$$
);

SELECT cron.schedule(
  'scrape-brightermonday-8am-eat',
  '5 5 * * *',
  $$SELECT public.invoke_site_scraper_edge('scrape-brightermonday', 12);$$
);

SELECT cron.schedule(
  'scrape-myjobmag-8am-eat',
  '10 5 * * *',
  $$SELECT public.invoke_site_scraper_edge('scrape-myjobmag', 12);$$
);

SELECT cron.schedule(
  'scrape-myjobsinkenya-8am-eat',
  '15 5 * * *',
  $$SELECT public.invoke_site_scraper_edge('scrape-myjobsinkenya', 12);$$
);

SELECT cron.schedule(
  'scrape-linkedin-8am-eat',
  '20 5 * * *',
  $$SELECT public.invoke_site_scraper_edge('scrape-linkedin', 12);$$
);
