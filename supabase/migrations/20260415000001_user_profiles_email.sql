-- Add email column to user_profiles so it can be used as display name fallback
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS email text;

-- Backfill existing rows from auth.users
UPDATE public.user_profiles up
SET email = au.email
FROM auth.users au
WHERE au.id = up.id;

-- Update the trigger to also store email on new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
  ON CONFLICT (id) DO UPDATE
    SET display_name = COALESCE(EXCLUDED.display_name, public.user_profiles.display_name),
        email = COALESCE(EXCLUDED.email, public.user_profiles.email);
  RETURN NEW;
END;
$$;
