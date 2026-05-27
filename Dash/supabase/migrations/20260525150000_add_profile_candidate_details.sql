-- Add drafting preference columns to profiles
ALTER TABLE public.profiles
ADD COLUMN notice_period text DEFAULT NULL,
ADD COLUMN years_of_experience text DEFAULT NULL;
