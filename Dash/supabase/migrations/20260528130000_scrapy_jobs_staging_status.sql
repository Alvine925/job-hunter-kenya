-- Migration: Add status tracking columns to public.scrapy_jobs staging table.
-- Created at 2026-05-28 by Antigravity

ALTER TABLE public.scrapy_jobs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.scrapy_jobs ADD COLUMN IF NOT EXISTS processed_at timestamp with time zone;
ALTER TABLE public.scrapy_jobs ADD COLUMN IF NOT EXISTS error_message text;

-- Create an index on status for fast lookup during 10-minute cron batches
CREATE INDEX IF NOT EXISTS scrapy_jobs_status_idx ON public.scrapy_jobs (status) WHERE status = 'pending';
