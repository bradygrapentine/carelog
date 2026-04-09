BEGIN;
SELECT plan(6);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aa110001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@symptom-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bb220002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'caregiver@symptom-rls.com', now(), now(), now(), '{}', '{}', false),
  ('cc330003-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'supporter@symptom-rls.com', now(), now(), now(), '{}', '{}', false),
  ('dd440004-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
   'outsider@symptom-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('11000000-0000-0000-0000-000000000001', 'Symptom RLS Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (org_id, full_name)
VALUES ('11000000-0000-0000-0000-000000000001', 'Symptom Test Recipient')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT '21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', token
FROM identity_vault WHERE org_id = '11000000-0000-0000-0000-000000000001' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
VALUES
  ('11000000-0000-0000-0000-000000000001', 'aa110001-0000-0000-0000-000000000001', 'coordinator', now(), null),
  ('11000000-0000-0000-0000-000000000001', 'bb220002-0000-0000-0000-000000000002', 'caregiver',   now(), '21000000-0000-0000-0000-000000000001'),
  ('11000000-0000-0000-0000-000000000001', 'cc330003-0000-0000-0000-000000000003', 'supporter',   now(), null)
ON CONFLICT DO NOTHING;

-- Fixture reading — inserted as postgres to bypass RLS
INSERT INTO symptom_readings (id, org_id, recipient_id, logged_by, pain_level, mood, recorded_at)
VALUES (
  '31000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000001',
  'aa110001-0000-0000-0000-000000000001',
  4, 'okay', now()
) ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Coordinator can INSERT a symptom_reading
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa110001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$INSERT INTO symptom_readings (org_id, recipient_id, logged_by, pain_level, mood)
    VALUES (
      '11000000-0000-0000-0000-000000000001',
      '21000000-0000-0000-0000-000000000001',
      'aa110001-0000-0000-0000-000000000001',
      3, 'good'
    )$$,
  'coordinator can insert a symptom_reading'
);

-- 2. Caregiver can INSERT a symptom_reading
SET LOCAL "request.jwt.claims" TO '{"sub":"bb220002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT lives_ok(
  $$INSERT INTO symptom_readings (org_id, recipient_id, logged_by, pain_level, mood)
    VALUES (
      '11000000-0000-0000-0000-000000000001',
      '21000000-0000-0000-0000-000000000001',
      'bb220002-0000-0000-0000-000000000002',
      6, 'difficult'
    )$$,
  'caregiver can insert a symptom_reading'
);

-- 3. Supporter CANNOT INSERT a symptom_reading
SET LOCAL "request.jwt.claims" TO '{"sub":"cc330003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO symptom_readings (org_id, recipient_id, logged_by, pain_level, mood)
    VALUES (
      '11000000-0000-0000-0000-000000000001',
      '21000000-0000-0000-0000-000000000001',
      'cc330003-0000-0000-0000-000000000003',
      2, 'okay'
    )$$,
  '42501', NULL,
  'supporter cannot insert a symptom_reading'
);

-- 4. Coordinator can SELECT readings for their org
SET LOCAL "request.jwt.claims" TO '{"sub":"aa110001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM symptom_readings WHERE org_id = '11000000-0000-0000-0000-000000000001'$$,
  ARRAY[3]::int[],
  'coordinator can read symptom_readings for their org'
);

-- 5. Outsider (not a member) sees 0 rows
SET LOCAL "request.jwt.claims" TO '{"sub":"dd440004-0000-0000-0000-000000000004","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM symptom_readings WHERE org_id = '11000000-0000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'non-member cannot read symptom_readings from another org'
);

-- 6. Direct DELETE is blocked (no delete policy exists)
SET LOCAL "request.jwt.claims" TO '{"sub":"aa110001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT throws_ok(
  $$DELETE FROM symptom_readings WHERE id = '31000000-0000-0000-0000-000000000001'$$,
  '42501', NULL,
  'direct delete on symptom_readings is blocked by RLS'
);

SELECT * FROM finish();
ROLLBACK;
