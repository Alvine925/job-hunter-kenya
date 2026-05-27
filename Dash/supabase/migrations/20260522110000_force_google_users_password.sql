-- Add has_set_password column to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_set_password BOOLEAN NOT NULL DEFAULT false;

-- Update existing profiles to true if they signed up using an email provider (already had passwords)
-- or if they have a non-empty password hash/encrypted password in auth.users.
UPDATE public.profiles p
SET has_set_password = true
FROM auth.users u
WHERE p.id = u.id AND (
  u.raw_app_meta_data->>'provider' = 'email' 
  OR (u.raw_app_meta_data->'providers')::jsonb ? 'email'
  OR (u.encrypted_password IS NOT NULL AND u.encrypted_password <> '')
);

-- Update the handle_new_user trigger function to automatically set has_set_password
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_email_provider BOOLEAN;
BEGIN
  -- Check if provider list contains email or primary provider is email
  is_email_provider := (
    NEW.raw_app_meta_data->>'provider' = 'email'
    OR (NEW.raw_app_meta_data->'providers')::jsonb ? 'email'
  );

  INSERT INTO public.profiles (id, email, full_name, has_set_password)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    is_email_provider
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(profiles.full_name, EXCLUDED.full_name);
  RETURN NEW;
END; $$;

-- Revoke execute permissions on the trigger function from general roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
