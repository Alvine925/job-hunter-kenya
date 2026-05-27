-- Run ONCE in Supabase Dashboard → SQL Editor (project eqkctzjyqmafpytvdepf)
--
-- Same value as Edge secret CRON_SECRET (Edge Functions → Secrets)
--
-- If scrape_cron_auth already exists, delete it first:
--   DELETE FROM vault.secrets WHERE name = 'scrape_cron_auth';

SELECT vault.create_secret(
  'PASTE_YOUR_CRON_SECRET_HERE',
  'scrape_cron_auth',
  'Auth for daily 8am board scrapers (must match CRON_SECRET)'
);

-- Verify all 5 cron jobs (08:00–08:20 EAT):
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'scrape-%8am-eat'
ORDER BY schedule;

-- Test one scraper now:
-- SELECT public.invoke_site_scraper_edge('scrape-fuzu', 2);
