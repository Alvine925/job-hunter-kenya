
ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS target_companies TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cv_parsed_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parsed_cv_text TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS pack_questions TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS pack_answers TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS application_type TEXT NOT NULL DEFAULT 'email';
