-- Restore the email-localpart fallback to handle_new_user() that was lost
-- in 20260415000001_user_profiles_email.sql.
--
-- Before: NEW.raw_user_meta_data->>'full_name'  (NULL for magic-link signups)
-- After:  COALESCE(meta->>'full_name', split_part(email, '@', 1))
--
-- Also backfills existing user_profiles where display_name IS NULL but email
-- IS NOT NULL — these are real users who signed up via magic link between
-- 2026-04-15 and 2026-04-28 and have been showing up as "Team member" or as
-- a raw email on the team page.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
    SET display_name = COALESCE(EXCLUDED.display_name, public.user_profiles.display_name),
        email        = COALESCE(EXCLUDED.email,        public.user_profiles.email);
  RETURN NEW;
END;
$$;

UPDATE public.user_profiles
SET display_name = split_part(email, '@', 1)
WHERE display_name IS NULL
  AND email IS NOT NULL;
