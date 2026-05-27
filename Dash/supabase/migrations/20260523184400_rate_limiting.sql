-- Migration: Create login_attempts table and set up password change trigger.
-- Created at 2026-05-23 by Antigravity

CREATE TABLE IF NOT EXISTS public.login_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Create function to handle password change unlocking
CREATE OR REPLACE FUNCTION public.handle_password_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.encrypted_password <> OLD.encrypted_password THEN
    DELETE FROM public.login_attempts WHERE email = NEW.email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to clear lockout when password is updated
CREATE OR REPLACE TRIGGER on_password_change
  AFTER UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_password_change();
