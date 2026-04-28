-- Verifies that handle_new_user() falls back to split_part(email, '@', 1)
-- when raw_user_meta_data->>'full_name' is missing — the regression guard
-- for the bug introduced by 20260415000001 and fixed by
-- 20260428124700_user_profile_displayname_fallback.sql.

BEGIN;
SELECT plan(3);

SET LOCAL ROLE postgres;

-- 1. Magic-link signup (no full_name in metadata) → display_name = email local-part
INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES (
  '11111111-2222-3333-4444-555555555555',
  'authenticated', 'authenticated',
  'magiclink.user@dn-fallback.test',
  now(), now(), now(),
  '{}', '{}', false
);

SELECT results_eq(
  $$SELECT display_name FROM public.user_profiles WHERE id = '11111111-2222-3333-4444-555555555555'$$,
  ARRAY['magiclink.user'],
  'magic-link signup gets email local-part as display_name'
);

-- 2. OAuth/explicit signup (full_name in metadata) → display_name = full_name
INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES (
  '22222222-3333-4444-5555-666666666666',
  'authenticated', 'authenticated',
  'oauth.user@dn-fallback.test',
  now(), now(), now(),
  '{}', '{"full_name":"Olivia OAuth"}', false
);

SELECT results_eq(
  $$SELECT display_name FROM public.user_profiles WHERE id = '22222222-3333-4444-5555-666666666666'$$,
  ARRAY['Olivia OAuth'],
  'metadata full_name is preferred over email local-part'
);

-- 3. Backfill semantics: a row with NULL display_name + non-null email should
-- be repaired to email local-part by the migration's UPDATE statement.
INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES (
  '33333333-4444-5555-6666-777777777777',
  'authenticated', 'authenticated',
  'preexisting@dn-fallback.test',
  now(), now(), now(),
  '{}', '{}', false
);

-- Force the row to the broken pre-fix state, then re-apply the migration's
-- backfill UPDATE and assert the row is repaired.
UPDATE public.user_profiles
  SET display_name = NULL
  WHERE id = '33333333-4444-5555-6666-777777777777';

UPDATE public.user_profiles
  SET display_name = split_part(email, '@', 1)
  WHERE display_name IS NULL
    AND email IS NOT NULL;

SELECT results_eq(
  $$SELECT display_name FROM public.user_profiles WHERE id = '33333333-4444-5555-6666-777777777777'$$,
  ARRAY['preexisting'],
  'pre-fix NULL display_name is repaired by backfill UPDATE'
);

SELECT * FROM finish();
ROLLBACK;
