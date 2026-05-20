-- ON-77: pgTAP coverage for the tasks model, RLS, completion predicate, and the
-- tasks_update_guard trigger.
--
-- Fixture UUID prefix: aa77xxxx-... to avoid collisions with other test files run
-- under the same `supabase test db` session.
--
-- Coverage:
--   schema:  tasks + task_permissions tables, task_status enum, RLS enabled
--   FIND-001 cross-org: member reads in-org task; outsider reads 0; outsider INSERT denied
--   create-perm: caregiver (not in default creator_roles) INSERT denied; coordinator allowed
--   FIND-002 completion: coordinator completes (allow); caregiver completes (deny);
--            caregiver completes after completer_roles widened (allow); cross-org coordinator blocked
--   FIND-002b forgery: completed_by is server-forced to auth.uid() regardless of submitted value
--   escalation: non-creator caregiver edits title -> denied
--   immutability: created_by update -> denied
--   cancel: non-creator non-coordinator cancel -> denied
--   FIND-003: non-coordinator UPDATE of task_permissions -> 0 rows (silently blocked by USING)
--   FIND-005: both predicate fns have pinned search_path

BEGIN;
SELECT plan(31);

-- ─── fixtures (as postgres, bypassing RLS) ───────────────────────────────────
SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aa770001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coordA@tasks-rls.com', now(), now(), now(), '{}', '{}', false),
  ('aa770002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'caregiverA@tasks-rls.com', now(), now(), now(), '{}', '{}', false),
  ('aa770003-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'coordB@tasks-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type) VALUES
  ('aa770100-0000-0000-0000-000000000001', 'Tasks Org A', 'family'),
  ('aa770100-0000-0000-0000-000000000002', 'Tasks Org B', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (token, org_id, full_name) VALUES
  ('aa770150-0000-0000-0000-000000000001', 'aa770100-0000-0000-0000-000000000001', 'Recipient A')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token) VALUES
  ('aa770200-0000-0000-0000-000000000001', 'aa770100-0000-0000-0000-000000000001', 'aa770150-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id) VALUES
  ('aa770100-0000-0000-0000-000000000001', 'aa770001-0000-0000-0000-000000000001', 'coordinator', now(), null),
  ('aa770100-0000-0000-0000-000000000001', 'aa770002-0000-0000-0000-000000000002', 'caregiver',   now(), 'aa770200-0000-0000-0000-000000000001'),
  ('aa770100-0000-0000-0000-000000000002', 'aa770003-0000-0000-0000-000000000003', 'coordinator', now(), null)
ON CONFLICT DO NOTHING;

-- baseline task in org A, created by the coordinator
INSERT INTO tasks (id, org_id, recipient_id, title, created_by, requested_by) VALUES
  ('aa770300-0000-0000-0000-000000000001', 'aa770100-0000-0000-0000-000000000001',
   'aa770200-0000-0000-0000-000000000001', 'Baseline task',
   'aa770001-0000-0000-0000-000000000001', 'aa770001-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ─── schema ──────────────────────────────────────────────────────────────────
SELECT has_table('public', 'tasks', 'tasks table exists');
SELECT has_table('public', 'task_permissions', 'task_permissions table exists');
SELECT has_type('public', 'task_status', 'task_status enum exists');
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.tasks'::regclass),
  true, 'RLS enabled on tasks');
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.task_permissions'::regclass),
  true, 'RLS enabled on task_permissions');

-- ─── FIND-001 cross-org isolation ─────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa770002-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT results_eq(
  $$SELECT count(*)::int FROM tasks WHERE recipient_id = 'aa770200-0000-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'org-A member can read in-org task');

SET LOCAL "request.jwt.claims" TO '{"sub":"aa770003-0000-0000-0000-000000000003","role":"authenticated"}';
SELECT results_eq(
  $$SELECT count(*)::int FROM tasks WHERE recipient_id = 'aa770200-0000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'FIND-001: org-B coordinator cannot read org-A task');

SELECT throws_ok(
  $$INSERT INTO tasks (org_id, recipient_id, title, created_by, requested_by)
    VALUES ('aa770100-0000-0000-0000-000000000001','aa770200-0000-0000-0000-000000000001',
            'x','aa770003-0000-0000-0000-000000000003','aa770003-0000-0000-0000-000000000003')$$,
  '42501',
  'new row violates row-level security policy for table "tasks"',
  'FIND-001: org-B coordinator cannot INSERT into org-A');

-- ─── create-permission ────────────────────────────────────────────────────────
-- caregiver is NOT in the default creator_roles ({coordinator}) -> INSERT denied
SET LOCAL "request.jwt.claims" TO '{"sub":"aa770002-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT throws_ok(
  $$INSERT INTO tasks (org_id, recipient_id, title, created_by, requested_by)
    VALUES ('aa770100-0000-0000-0000-000000000001','aa770200-0000-0000-0000-000000000001',
            'caregiver task','aa770002-0000-0000-0000-000000000002','aa770002-0000-0000-0000-000000000002')$$,
  '42501',
  'new row violates row-level security policy for table "tasks"',
  'caregiver (not in creator_roles) cannot INSERT a task');

-- coordinator CAN insert
SET LOCAL "request.jwt.claims" TO '{"sub":"aa770001-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT lives_ok(
  $$INSERT INTO tasks (id, org_id, recipient_id, title, created_by, requested_by)
    VALUES ('aa770300-0000-0000-0000-000000000002','aa770100-0000-0000-0000-000000000001',
            'aa770200-0000-0000-0000-000000000001','Coord task',
            'aa770001-0000-0000-0000-000000000001','aa770001-0000-0000-0000-000000000001')$$,
  'coordinator can INSERT a task');

-- ─── FIND-002 completion ──────────────────────────────────────────────────────
-- caregiver (not in default completer_roles) cannot complete
SET LOCAL "request.jwt.claims" TO '{"sub":"aa770002-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT throws_like(
  $$UPDATE tasks SET status = 'done' WHERE id = 'aa770300-0000-0000-0000-000000000001'$$,
  '%tasks_complete_forbidden%',
  'FIND-002: caregiver cannot complete a task (default completer_roles)');

-- coordinator completes -> allowed, completed_at/by set
SET LOCAL "request.jwt.claims" TO '{"sub":"aa770001-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT lives_ok(
  $$UPDATE tasks SET status = 'done' WHERE id = 'aa770300-0000-0000-0000-000000000002'$$,
  'FIND-002: coordinator can complete a task');
SELECT results_eq(
  $$SELECT status::text, (completed_by IS NOT NULL), (completed_at IS NOT NULL)
    FROM tasks WHERE id = 'aa770300-0000-0000-0000-000000000002'$$,
  $$VALUES ('done', true, true)$$,
  'completion sets status=done + completed_by/at');

-- FIND-002b forgery: coordinator completes baseline passing a FOREIGN completed_by
SELECT lives_ok(
  $$UPDATE tasks SET status = 'done', completed_by = 'aa770002-0000-0000-0000-000000000002'
    WHERE id = 'aa770300-0000-0000-0000-000000000001'$$,
  'completion with submitted completed_by lives');
SELECT results_eq(
  $$SELECT completed_by FROM tasks WHERE id = 'aa770300-0000-0000-0000-000000000001'$$,
  $$VALUES ('aa770001-0000-0000-0000-000000000001'::uuid)$$,
  'FIND-002b: completed_by is server-forced to auth.uid(), not the submitted value');

-- widen completer_roles to include caregiver, then caregiver completes a fresh task
SET LOCAL ROLE postgres;
INSERT INTO task_permissions (org_id, completer_roles)
  VALUES ('aa770100-0000-0000-0000-000000000001', '{coordinator,caregiver}')
  ON CONFLICT (org_id) DO UPDATE SET completer_roles = EXCLUDED.completer_roles;
INSERT INTO tasks (id, org_id, recipient_id, title, created_by, requested_by) VALUES
  ('aa770300-0000-0000-0000-000000000003', 'aa770100-0000-0000-0000-000000000001',
   'aa770200-0000-0000-0000-000000000001', 'Widened task',
   'aa770001-0000-0000-0000-000000000001', 'aa770001-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa770002-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT lives_ok(
  $$UPDATE tasks SET status = 'done' WHERE id = 'aa770300-0000-0000-0000-000000000003'$$,
  'FIND-002: caregiver completes after completer_roles widened to include caregiver');

-- ─── escalation: caregiver edits a task they didn't create ────────────────────
SELECT throws_like(
  $$UPDATE tasks SET title = 'hijacked' WHERE id = 'aa770300-0000-0000-0000-000000000002'$$,
  '%tasks_edit_forbidden%',
  'escalation: non-creator caregiver cannot edit task content');

-- ─── immutability: created_by ─────────────────────────────────────────────────
SET LOCAL "request.jwt.claims" TO '{"sub":"aa770001-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT throws_like(
  $$UPDATE tasks SET created_by = 'aa770002-0000-0000-0000-000000000002'
    WHERE id = 'aa770300-0000-0000-0000-000000000002'$$,
  '%tasks_immutable_column%',
  'immutability: created_by cannot change');

-- ─── cancel: non-creator non-coordinator denied ───────────────────────────────
-- caregiver tries to cancel the coordinator-created task
SET LOCAL "request.jwt.claims" TO '{"sub":"aa770002-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT throws_like(
  $$UPDATE tasks SET status = 'cancelled' WHERE id = 'aa770300-0000-0000-0000-000000000003'$$,
  '%tasks_cancel_forbidden%',
  'cancel: non-creator non-coordinator cannot cancel');

-- ─── FIND-003: non-coordinator cannot mutate task_permissions ─────────────────
-- caregiver UPDATE matches 0 rows (USING coordinator-only); value unchanged.
SELECT results_eq(
  $$WITH u AS (
      UPDATE task_permissions SET completer_roles = '{coordinator,caregiver,aide}'
      WHERE org_id = 'aa770100-0000-0000-0000-000000000001' RETURNING 1)
    SELECT count(*)::int FROM u$$,
  ARRAY[0]::int[],
  'FIND-003: caregiver UPDATE of task_permissions affects 0 rows');

-- ─── FIND-005: pinned search_path on the predicate fns ────────────────────────
SET LOCAL ROLE postgres;
SELECT is(
  (SELECT 'search_path=public, pg_temp' = ANY(proconfig)
   FROM pg_proc WHERE proname = 'user_can_create_task' AND pronamespace = 'public'::regnamespace),
  true, 'FIND-005: user_can_create_task has pinned search_path');
SELECT is(
  (SELECT 'search_path=public, pg_temp' = ANY(proconfig)
   FROM pg_proc WHERE proname = 'user_can_complete_task' AND pronamespace = 'public'::regnamespace),
  true, 'FIND-005: user_can_complete_task has pinned search_path');

-- ─── TD-218: DELETE policy + de-completion + revive + positive edit/reassign ──
-- Isolated fixtures (...004–...008) so these cases don't depend on prior mutations.
SET LOCAL ROLE postgres;
INSERT INTO tasks (id, org_id, recipient_id, title, created_by, requested_by, status) VALUES
  ('aa770300-0000-0000-0000-000000000004','aa770100-0000-0000-0000-000000000001',
   'aa770200-0000-0000-0000-000000000001','Delete-positive','aa770001-0000-0000-0000-000000000001','aa770001-0000-0000-0000-000000000001','todo'),
  ('aa770300-0000-0000-0000-000000000005','aa770100-0000-0000-0000-000000000001',
   'aa770200-0000-0000-0000-000000000001','Delete-deny','aa770001-0000-0000-0000-000000000001','aa770001-0000-0000-0000-000000000001','todo'),
  ('aa770300-0000-0000-0000-000000000006','aa770100-0000-0000-0000-000000000001',
   'aa770200-0000-0000-0000-000000000001','Done-task','aa770001-0000-0000-0000-000000000001','aa770001-0000-0000-0000-000000000001','done'),
  ('aa770300-0000-0000-0000-000000000007','aa770100-0000-0000-0000-000000000001',
   'aa770200-0000-0000-0000-000000000001','Cancelled-task','aa770001-0000-0000-0000-000000000001','aa770001-0000-0000-0000-000000000001','cancelled'),
  ('aa770300-0000-0000-0000-000000000008','aa770100-0000-0000-0000-000000000001',
   'aa770200-0000-0000-0000-000000000001','Edit-target','aa770001-0000-0000-0000-000000000001','aa770001-0000-0000-0000-000000000001','todo')
ON CONFLICT DO NOTHING;

-- DELETE deny: caregiver is not a coordinator → tasks_deletable_by_coordinator USING
-- filters the row out; the DELETE matches 0 rows (RLS silently skips, does NOT throw).
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa770002-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT results_eq(
  $$WITH d AS (DELETE FROM tasks WHERE id = 'aa770300-0000-0000-0000-000000000005' RETURNING 1)
    SELECT count(*)::int FROM d$$,
  ARRAY[0]::int[],
  'TD-218 DELETE deny: non-coordinator DELETE affects 0 rows (row survives)');
SELECT results_eq(
  $$SELECT count(*)::int FROM tasks WHERE id = 'aa770300-0000-0000-0000-000000000005'$$,
  ARRAY[1]::int[],
  'TD-218 DELETE deny: target row still exists after blocked DELETE');

-- DELETE positive: coordinator CAN delete → row is gone (results_eq = 0 afterward).
SET LOCAL "request.jwt.claims" TO '{"sub":"aa770001-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT lives_ok(
  $$DELETE FROM tasks WHERE id = 'aa770300-0000-0000-0000-000000000004'$$,
  'TD-218 DELETE positive: coordinator DELETE lives');
SELECT results_eq(
  $$SELECT count(*)::int FROM tasks WHERE id = 'aa770300-0000-0000-0000-000000000004'$$,
  ARRAY[0]::int[],
  'TD-218 DELETE positive: row gone after coordinator DELETE');

-- De-completion done→todo by a completer (coordinator) → allowed; completed_by/at nulled.
SELECT lives_ok(
  $$UPDATE tasks SET status = 'todo' WHERE id = 'aa770300-0000-0000-0000-000000000006'$$,
  'TD-218 de-completion: coordinator reverts done→todo');
SELECT results_eq(
  $$SELECT status::text, completed_by, completed_at
    FROM tasks WHERE id = 'aa770300-0000-0000-0000-000000000006'$$,
  $$VALUES ('todo', NULL::uuid, NULL::timestamptz)$$,
  'TD-218 de-completion: completed_by/at cleared on done→todo');

-- Revive cancelled→todo by coordinator (cancel/revive authority) → allowed.
SELECT lives_ok(
  $$UPDATE tasks SET status = 'todo' WHERE id = 'aa770300-0000-0000-0000-000000000007'$$,
  'TD-218 revive: coordinator revives cancelled→todo');

-- Positive CAN-edit: coordinator edits title → allowed (complements the caregiver deny).
SELECT lives_ok(
  $$UPDATE tasks SET title = 'Edited by coordinator' WHERE id = 'aa770300-0000-0000-0000-000000000008'$$,
  'TD-218 positive edit: coordinator can edit task content');

-- assigned_to reassignment authz: caregiver (non-creator, not in creator_roles,
-- not coordinator) reassigning assigned_to is a content edit → tasks_edit_forbidden.
SET LOCAL "request.jwt.claims" TO '{"sub":"aa770002-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT throws_like(
  $$UPDATE tasks SET assigned_to = 'aa770002-0000-0000-0000-000000000002'
    WHERE id = 'aa770300-0000-0000-0000-000000000008'$$,
  '%tasks_edit_forbidden%',
  'TD-218 reassign authz: non-creator caregiver cannot change assigned_to');

SELECT * FROM finish();
ROLLBACK;
