-- Add projects column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS projects JSONB DEFAULT '[]'::jsonb;
