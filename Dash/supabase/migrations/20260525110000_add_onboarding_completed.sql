-- Migration: Add onboarding_completed column to profiles table.
-- Created at 2026-05-25 by Antigravity

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
