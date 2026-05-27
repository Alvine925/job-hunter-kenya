-- scraped_jobs created early may lack updated_at / scraped_at (PGRST204 on upsert).

ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.scraped_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.scraped_jobs SET scraped_at = now() WHERE scraped_at IS NULL;
UPDATE public.scraped_jobs SET updated_at = now() WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS scraped_jobs_touch ON public.scraped_jobs;
CREATE TRIGGER scraped_jobs_touch
  BEFORE UPDATE ON public.scraped_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
