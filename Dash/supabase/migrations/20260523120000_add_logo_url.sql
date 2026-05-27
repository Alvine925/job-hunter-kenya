-- Migration: Add logo_url column to jobs, job_listings, and scraped_jobs tables.
-- Created at 2026-05-23 by Antigravity

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE scraped_jobs ADD COLUMN IF NOT EXISTS logo_url text;
