
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS drive_file_id text,
  ADD COLUMN IF NOT EXISTS drive_url text,
  ADD COLUMN IF NOT EXISTS drive_folder_id text;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS match_reason text,
  ADD COLUMN IF NOT EXISTS match_strengths text,
  ADD COLUMN IF NOT EXISTS match_gaps text,
  ADD COLUMN IF NOT EXISTS scraped_at timestamptz DEFAULT now();
