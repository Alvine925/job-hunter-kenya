ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS linkedin_li_at TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_time_filter TEXT NOT NULL DEFAULT 'r86400';

COMMENT ON COLUMN public.user_integrations.linkedin_li_at IS
  'LinkedIn session cookie (li_at) for ScrapingBee authenticated job search';
COMMENT ON COLUMN public.user_integrations.linkedin_time_filter IS
  'LinkedIn f_TPR filter: r86400=24h, r604800=7d, r2592000=30d';
