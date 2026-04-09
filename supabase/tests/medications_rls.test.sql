BEGIN;
SELECT plan(5);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@med-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bbbb0002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'caregiver@med-rls.com', now(), now(), now(), '{}', '{}', false),
  ('cccc0003-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'outsider@med-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('10000000-0000-0000-0000-000000000001', 'Med RLS Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (org_id, full_name)
VALUES ('10000000-0000-0000-0000-000000000001', 'Test Recipient')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', token
FROM identity_vault WHERE org_id = '10000000-0000-0000-0000-000000000001' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'aaaa0001-0000-0000-0000-000000000001',
  'coordinator', now(), null
) ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'bbbb0002-0000-0000-0000-000000000002',
  'caregiver', now(), '20000000-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- Fixture medication — inserted as postgres to bypass RLS
INSERT INTO medications (id, org_id, recipient_id, drug_name, dosage, scan_source, active)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Lisinopril', '10mg once daily', 'manual', true
) ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Outsider cannot read medications (not a member of the org)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"cccc0003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM medications WHERE org_id = '10000000-0000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'outsider cannot read medications in org they do not belong to'
);

-- 2. Outsider cannot insert a medication (not an org member, user_can_access_recipient returns false)
SELECT throws_ok(
  $$INSERT INTO medications (org_id, recipient_id, drug_name, dosage, scan_source, active)
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'Metoprolol', '25mg twice daily', 'manual', true
    )$$,
  '42501', NULL,
  'outsider cannot insert medication'
);

-- 3. Caregiver can read medications in their org
SET LOCAL "request.jwt.claims" TO '{"sub":"bbbb0002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM medications WHERE org_id = '10000000-0000-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'caregiver can read medications in their org'
);

-- 4. Coordinator can read medications in their org
SET LOCAL "request.jwt.claims" TO '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM medications WHERE org_id = '10000000-0000-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'coordinator can read medications in their org'
);

-- 5. Coordinator can insert a medication
--    RLS policy: "medications writable by team" uses user_can_access_recipient — coordinator qualifies
SELECT lives_ok(
  $$INSERT INTO medications (org_id, recipient_id, drug_name, dosage, scan_source, active)
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'Amlodipine', '5mg once daily', 'manual', true
    )$$,
  'coordinator can insert medication'
);

SELECT * FROM finish();
ROLLBACK;
