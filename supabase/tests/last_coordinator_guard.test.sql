BEGIN;
SELECT plan(2);

-- Seed: one coordinator in Org X
INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('dddddddd-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated',
   'coord-x@last.test', now(), now(), now(), '{}', '{}', false),
  ('dddddddd-0000-0000-0000-0000000000d2', 'authenticated', 'authenticated',
   'coord-x2@last.test', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('55555555-5555-5555-5555-555555555555', 'Last-Coord Test Org', 'family')
ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (id, org_id, user_id, role, accepted_at)
VALUES (
  '66666666-6666-6666-6666-666666666661',
  '55555555-5555-5555-5555-555555555555',
  'dddddddd-0000-0000-0000-0000000000d1',
  'coordinator',
  now()
) ON CONFLICT DO NOTHING;

-- 1. Deleting the only coordinator should fail with check_violation
SELECT throws_ok(
  $$ DELETE FROM memberships WHERE id = '66666666-6666-6666-6666-666666666661' $$,
  '23514',
  NULL,
  'cannot delete the last coordinator'
);

-- 2. With two coordinators, deleting one should succeed
INSERT INTO memberships (id, org_id, user_id, role, accepted_at)
VALUES (
  '66666666-6666-6666-6666-666666666662',
  '55555555-5555-5555-5555-555555555555',
  'dddddddd-0000-0000-0000-0000000000d2',
  'coordinator',
  now()
);

SELECT lives_ok(
  $$ DELETE FROM memberships WHERE id = '66666666-6666-6666-6666-666666666662' $$,
  'can delete a coordinator when another remains'
);

SELECT * FROM finish();
ROLLBACK;
