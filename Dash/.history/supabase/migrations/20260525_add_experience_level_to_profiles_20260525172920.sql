-- Add experience_level column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS experience_level TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN public.profiles.experience_level IS 'User experience level (e.g., entry, mid, senior)';
