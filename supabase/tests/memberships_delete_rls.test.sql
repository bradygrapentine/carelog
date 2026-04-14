BEGIN;
SELECT plan(3);

-- Create two auth users: coordinator A (org A), coordinator B (different org),
-- and caregiver C (target for deletion).
INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord-a@mem-del.test', now(), now(), now(), '{}', '{}', false),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'coord-b@mem-del.test', now(), now(), now(), '{}', '{}', false),
  ('cccccccc-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'care-c@mem-del.test', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

-- Org A: coordinator A + caregiver C
INSERT INTO organizations (id, name, org_type)
VALUES ('11111111-0000-0000-0000-000000000001', 'Mem Del Org A', 'family')
ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'coordinator', now()),
  ('11111111-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003', 'caregiver',   now())
ON CONFLICT DO NOTHING;

-- Org B: coordinator B only (different org)
INSERT INTO organizations (id, name, org_type)
VALUES ('22222222-0000-0000-0000-000000000002', 'Mem Del Org B', 'family')
ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at)
VALUES ('22222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'coordinator', now())
ON CONFLICT DO NOTHING;

-- 1. Coordinator A deletes caregiver C in Org A
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}';

WITH deleted AS (
  DELETE FROM memberships
  WHERE org_id = '11111111-0000-0000-0000-000000000001'
    AND user_id = 'cccccccc-0000-0000-0000-000000000003'
  RETURNING 1
)
SELECT is(
  (SELECT count(*)::int FROM deleted),
  1,
  'coordinator can delete caregiver in their own org'
);

-- 2. Coordinator B (different org) cannot delete members in Org A
RESET ROLE;
INSERT INTO memberships (org_id, user_id, role, accepted_at)
VALUES ('11111111-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003', 'caregiver', now());

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002"}';

WITH deleted AS (
  DELETE FROM memberships
  WHERE org_id = '11111111-0000-0000-0000-000000000001'
    AND user_id = 'cccccccc-0000-0000-0000-000000000003'
  RETURNING 1
)
SELECT is(
  (SELECT count(*)::int FROM deleted),
  0,
  'cross-org coordinator cannot delete membership'
);

-- 3. Anon cannot delete any membership
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
WITH deleted AS (
  DELETE FROM memberships RETURNING 1
)
SELECT is(
  (SELECT count(*)::int FROM deleted),
  0,
  'anon cannot delete memberships'
);

SELECT * FROM finish();
ROLLBACK;
