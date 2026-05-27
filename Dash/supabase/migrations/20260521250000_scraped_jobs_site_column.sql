-- Legacy scraped_jobs has NOT NULL "site". App sets site/source from source_url hostname (see sourceLabelFromUrl).

ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS site TEXT;

UPDATE public.scraped_jobs SET source = site WHERE (source IS NULL OR source = '') AND site IS NOT NULL;
UPDATE public.scraped_jobs SET site = source WHERE (site IS NULL OR site = '') AND source IS NOT NULL;
UPDATE public.scraped_jobs SET site = coalesce(nullif(site, ''), nullif(source, ''), 'Unknown');
UPDATE public.scraped_jobs SET source = coalesce(nullif(source, ''), nullif(site, ''), 'Unknown');

ALTER TABLE public.scraped_jobs ALTER COLUMN site SET DEFAULT 'Unknown';
