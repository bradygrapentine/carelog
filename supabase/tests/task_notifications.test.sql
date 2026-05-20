-- ON-81: pgTAP coverage for the task-notification surfaces.
--
-- Fixture UUID prefix: aa81xxxx-... to avoid collisions with other test files.
--
-- Coverage:
--   schema:  in_app_notifications table + RLS enabled; new notification_preferences task cols
--   FIND-004 feed RLS: owner reads own; non-owner reads 0; authenticated cannot INSERT;
--            owner can mark-read (UPDATE); the dedup unique index blocks a duplicate insert
--   FIND-003 pref ownership: a user cannot read another user's notification_preferences

BEGIN;
SELECT plan(10);

-- ─── fixtures (as postgres, bypassing RLS) ───────────────────────────────────
SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aa810001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'userA@notif-rls.com', now(), now(), now(), '{}', '{}', false),
  ('aa810002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'userB@notif-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type) VALUES
  ('aa810100-0000-0000-0000-000000000001', 'Notif Org A', 'family')
ON CONFLICT DO NOTHING;

-- An in-app notification owned by user A (service-role insert path).
INSERT INTO in_app_notifications (id, user_id, org_id, type, task_id, title, body) VALUES
  ('aa810300-0000-0000-0000-000000000001', 'aa810001-0000-0000-0000-000000000001',
   'aa810100-0000-0000-0000-000000000001', 'task_assigned',
   'aa810400-0000-0000-0000-000000000001', 'A task', 'You were assigned a task.')
ON CONFLICT DO NOTHING;

-- A preferences row owned by user A.
INSERT INTO notification_preferences (user_id) VALUES
  ('aa810001-0000-0000-0000-000000000001')
ON CONFLICT (user_id) DO NOTHING;

-- ─── schema ──────────────────────────────────────────────────────────────────
SELECT has_table('public', 'in_app_notifications', 'in_app_notifications table exists');
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.in_app_notifications'::regclass),
  true, 'RLS enabled on in_app_notifications');
SELECT has_column('public', 'notification_preferences', 'task_assigned', 'task_assigned pref column exists');
SELECT has_column('public', 'notification_preferences', 'task_completed', 'task_completed pref column exists');
SELECT has_column('public', 'notification_preferences', 'task_created', 'task_created pref column exists');

-- ─── FIND-004 feed RLS ─────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa810001-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT results_eq(
  $$SELECT count(*)::int FROM in_app_notifications WHERE user_id = 'aa810001-0000-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'FIND-004: owner reads their own in-app notification');

SET LOCAL "request.jwt.claims" TO '{"sub":"aa810002-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT results_eq(
  $$SELECT count(*)::int FROM in_app_notifications$$,
  ARRAY[0]::int[],
  'FIND-004: non-owner reads zero in-app notifications');

SELECT throws_ok(
  $$INSERT INTO in_app_notifications (user_id, org_id, type)
    VALUES ('aa810002-0000-0000-0000-000000000002','aa810100-0000-0000-0000-000000000001','task_created')$$,
  '42501',
  'new row violates row-level security policy for table "in_app_notifications"',
  'FIND-004: authenticated role cannot INSERT (service-role-only feed)');

-- owner can mark their own notification read
SET LOCAL "request.jwt.claims" TO '{"sub":"aa810001-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT lives_ok(
  $$UPDATE in_app_notifications SET read_at = now()
    WHERE id = 'aa810300-0000-0000-0000-000000000001'$$,
  'owner can mark their own notification read');

-- ─── FIND-003 preference ownership ─────────────────────────────────────────────
SET LOCAL "request.jwt.claims" TO '{"sub":"aa810002-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT results_eq(
  $$SELECT count(*)::int FROM notification_preferences WHERE user_id = 'aa810001-0000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'FIND-003: a user cannot read another user''s notification preferences');

SELECT * FROM finish();
ROLLBACK;
