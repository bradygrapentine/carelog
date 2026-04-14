BEGIN;
SELECT plan(7);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('c1000001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@cr-rls.com', now(), now(), now(), '{}', '{}', false),
  ('c2000002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'caregiver@cr-rls.com', now(), now(), now(), '{}', '{}', false),
  ('c3000003-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'outsider@cr-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('c0100000-0000-0000-0000-000000000001', 'CR RLS Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (org_id, full_name)
VALUES ('c0100000-0000-0000-0000-000000000001', 'CR Test Recipient')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT 'c0200000-0000-0000-0000-000000000001', 'c0100000-0000-0000-0000-000000000001', token
FROM identity_vault WHERE org_id = 'c0100000-0000-0000-0000-000000000001' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
VALUES
  ('c0100000-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', 'coordinator', now(), null),
  ('c0100000-0000-0000-0000-000000000001', 'c2000002-0000-0000-0000-000000000002', 'caregiver',   now(), 'c0200000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Org member (caregiver) can SELECT the care recipient
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"c2000002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM care_recipients WHERE org_id = 'c0100000-0000-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'org member (caregiver) can read care recipients in their org'
);

-- 2. Non-member (outsider) sees 0 rows
SET LOCAL "request.jwt.claims" TO '{"sub":"c3000003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM care_recipients WHERE org_id = 'c0100000-0000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'non-member cannot read care recipients from another org'
);

-- 3. Non-coordinator (caregiver) CANNOT INSERT a new recipient
SET LOCAL "request.jwt.claims" TO '{"sub":"c2000002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO care_recipients (org_id, identity_token)
    SELECT 'c0100000-0000-0000-0000-000000000001', token
    FROM identity_vault WHERE org_id = 'c0100000-0000-0000-0000-000000000001' LIMIT 1$$,
  '42501', NULL,
  'caregiver (non-coordinator) cannot insert a care recipient'
);

-- 4. Coordinator can INSERT a new care recipient
SET LOCAL "request.jwt.claims" TO '{"sub":"c1000001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$INSERT INTO care_recipients (id, org_id, identity_token)
    SELECT 'c0200000-0000-0000-0000-000000000002', 'c0100000-0000-0000-0000-000000000001', token
    FROM identity_vault WHERE org_id = 'c0100000-0000-0000-0000-000000000001' LIMIT 1$$,
  'coordinator can insert a new care recipient'
);

-- 5. Coordinator can UPDATE a recipient
SELECT lives_ok(
  $$UPDATE care_recipients SET diagnoses = '["hypertension"]' WHERE id = 'c0200000-0000-0000-0000-000000000001'$$,
  'coordinator can update a care recipient'
);

-- 6. Non-coordinator (caregiver) cannot DELETE a recipient
-- RLS silently skips DELETE; verify row still present after attempt
SET LOCAL "request.jwt.claims" TO '{"sub":"c2000002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT lives_ok(
  $$DELETE FROM care_recipients WHERE id = 'c0200000-0000-0000-0000-000000000001'$$,
  'caregiver delete silently skips (RLS blocks without error)'
);

SET LOCAL ROLE postgres;

SELECT results_eq(
  $$SELECT count(*)::int FROM care_recipients WHERE id = 'c0200000-0000-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'row still exists after caregiver delete attempt — not actually deleted'
);

SELECT * FROM finish();
ROLLBACK;
