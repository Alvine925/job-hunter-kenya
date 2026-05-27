-- Migration: Add ai_processing_consent_at column to profiles table
-- This allows auditing user consent for sending CV data to third-party AI APIs.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_processing_consent_at TIMESTAMPTZ;
