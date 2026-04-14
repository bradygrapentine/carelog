BEGIN;
SELECT plan(7);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('a1000001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'owner@notifprefs-rls.com', now(), now(), now(), '{}', '{}', false),
  ('b2000002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'other@notifprefs-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

-- Fixture: owner's preferences — inserted as postgres to bypass RLS
INSERT INTO notification_preferences (user_id, push_enabled, email_enabled, digest_frequency)
VALUES (
  'a1000001-0000-0000-0000-000000000001',
  true, true, 'daily'
) ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Owner can SELECT their own preferences
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a1000001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM notification_preferences WHERE user_id = 'a1000001-0000-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'owner can read their own notification preferences'
);

-- 2. Owner can UPDATE their own preferences
SELECT lives_ok(
  $$UPDATE notification_preferences SET push_enabled = false WHERE user_id = 'a1000001-0000-0000-0000-000000000001'$$,
  'owner can update their own notification preferences'
);

-- 3. Cross-user: other user sees 0 rows (owner's row filtered out)
SET LOCAL "request.jwt.claims" TO '{"sub":"b2000002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM notification_preferences WHERE user_id = 'a1000001-0000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'another user cannot read a different user''s notification preferences'
);

-- 4. Cross-user: other user cannot INSERT preferences for the owner
SELECT throws_ok(
  $$INSERT INTO notification_preferences (user_id, push_enabled, email_enabled, digest_frequency)
    VALUES ('a1000001-0000-0000-0000-000000000001', false, false, 'never')$$,
  '42501', NULL,
  'another user cannot insert notification preferences for a different user_id'
);

-- 5. Cross-user: other user cannot UPDATE the owner's row
SELECT lives_ok(
  $$UPDATE notification_preferences SET push_enabled = false WHERE user_id = 'a1000001-0000-0000-0000-000000000001'$$,
  'update on another user''s row silently skips (RLS filters row, no error)'
);

-- Verify the above silent skip actually changed nothing (owner's row untouched)
SET LOCAL "request.jwt.claims" TO '{"sub":"a1000001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT email_enabled FROM notification_preferences WHERE user_id = 'a1000001-0000-0000-0000-000000000001'$$,
  ARRAY[true]::boolean[],
  'owner''s email_enabled is unchanged after cross-user update attempt'
);

-- 6. Anon role sees zero rows
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '';

SELECT results_eq(
  $$SELECT count(*)::int FROM notification_preferences$$,
  ARRAY[0]::int[],
  'anon sees zero notification_preferences rows'
);

SELECT * FROM finish();
ROLLBACK;
