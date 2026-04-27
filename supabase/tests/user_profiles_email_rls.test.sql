-- supabase/tests/user_profiles_email_rls.test.sql
--
-- Verifies that the email column added by 20260415000001_user_profiles_email.sql
-- inherits the parent table's RLS policies:
--   - A user can SELECT their own profile (including email)
--   - A user CANNOT SELECT another user's profile
--   - A user can UPDATE their own profile email
--   - A user CANNOT UPDATE another user's profile (silently blocked)

BEGIN;
SELECT plan(5);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aa010001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'alice@up-email-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bb020002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'bob@up-email-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, display_name, email)
VALUES
  ('aa010001-0000-0000-0000-000000000001', 'Alice', 'alice@up-email-rls.com'),
  ('bb020002-0000-0000-0000-000000000002', 'Bob',   'bob@up-email-rls.com')
ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      email        = EXCLUDED.email;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. User can SELECT their own profile (including email column)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa010001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT email FROM public.user_profiles WHERE id = 'aa010001-0000-0000-0000-000000000001'$$,
  ARRAY['alice@up-email-rls.com'],
  'user can SELECT their own profile email'
);

-- 2. User CANNOT SELECT another user's profile (RLS: id = auth.uid())
SELECT results_eq(
  $$SELECT count(*)::int FROM public.user_profiles WHERE id = 'bb020002-0000-0000-0000-000000000002'$$,
  ARRAY[0]::int[],
  'user cannot SELECT another user profile'
);

-- 3. User can UPDATE their own profile email
SELECT lives_ok(
  $$UPDATE public.user_profiles SET email = 'alice-new@up-email-rls.com' WHERE id = 'aa010001-0000-0000-0000-000000000001'$$,
  'user can UPDATE their own profile email'
);

-- 4. Email column update is persisted
SELECT results_eq(
  $$SELECT email FROM public.user_profiles WHERE id = 'aa010001-0000-0000-0000-000000000001'$$,
  ARRAY['alice-new@up-email-rls.com'],
  'email UPDATE was persisted for own profile'
);

-- 5. User CANNOT UPDATE another user's profile (RLS silently skips)
UPDATE public.user_profiles SET email = 'hacked@evil.com' WHERE id = 'bb020002-0000-0000-0000-000000000002';

SET LOCAL ROLE postgres;

SELECT results_eq(
  $$SELECT email FROM public.user_profiles WHERE id = 'bb020002-0000-0000-0000-000000000002'$$,
  ARRAY['bob@up-email-rls.com'],
  'user cannot UPDATE another user profile email (RLS silently skips)'
);

SELECT * FROM finish();
ROLLBACK;
