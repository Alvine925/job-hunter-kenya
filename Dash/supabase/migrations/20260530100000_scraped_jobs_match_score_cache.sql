-- Migration: Add match_score_cache JSONB column to scraped_jobs and create a GIN index for fast lookup.

ALTER TABLE public.scraped_jobs
  ADD COLUMN IF NOT EXISTS match_score_cache JSONB DEFAULT '{}'::jsonb NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scraped_jobs_match_cache 
  ON public.scraped_jobs USING GIN (match_score_cache);
