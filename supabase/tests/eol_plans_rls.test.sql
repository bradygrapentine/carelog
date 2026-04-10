BEGIN;
SELECT plan(7);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aa110001-3000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@eol-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bb220002-3000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'caregiver@eol-rls.com', now(), now(), now(), '{}', '{}', false),
  ('cc330003-3000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'supporter@eol-rls.com', now(), now(), now(), '{}', '{}', false),
  ('dd440004-3000-0000-0000-000000000004', 'authenticated', 'authenticated',
   'outsider@eol-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('11300000-3000-0000-0000-000000000001', 'EOL RLS Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (org_id, full_name)
VALUES ('11300000-3000-0000-0000-000000000001', 'EOL Test Recipient')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT '21300000-3000-0000-0000-000000000001', '11300000-3000-0000-0000-000000000001', token
FROM identity_vault WHERE org_id = '11300000-3000-0000-0000-000000000001' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
VALUES
  ('11300000-3000-0000-0000-000000000001', 'aa110001-3000-0000-0000-000000000001', 'coordinator', now(), null),
  ('11300000-3000-0000-0000-000000000001', 'bb220002-3000-0000-0000-000000000002', 'caregiver',   now(), '21300000-3000-0000-0000-000000000001'),
  ('11300000-3000-0000-0000-000000000001', 'cc330003-3000-0000-0000-000000000003', 'supporter',   now(), null)
ON CONFLICT DO NOTHING;

-- Fixture plan — inserted as postgres to bypass RLS
INSERT INTO eol_plans (id, org_id, recipient_id, created_by, healthcare_proxy, resuscitation_pref)
VALUES (
  '31300000-3000-0000-0000-000000000001',
  '11300000-3000-0000-0000-000000000001',
  '21300000-3000-0000-0000-000000000001',
  'aa110001-3000-0000-0000-000000000001',
  'Jane Smith - 555-0199', 'dnr'
) ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Coordinator can SELECT
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa110001-3000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM eol_plans WHERE org_id = '11300000-3000-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'coordinator can read eol_plans for their org'
);

-- 2. Caregiver sees 0 rows (completely hidden)
SET LOCAL "request.jwt.claims" TO '{"sub":"bb220002-3000-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM eol_plans WHERE org_id = '11300000-3000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'caregiver cannot read eol_plans'
);

-- 3. Supporter sees 0 rows
SET LOCAL "request.jwt.claims" TO '{"sub":"cc330003-3000-0000-0000-000000000003","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM eol_plans WHERE org_id = '11300000-3000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'supporter cannot read eol_plans'
);

-- 4. Outsider sees 0 rows
SET LOCAL "request.jwt.claims" TO '{"sub":"dd440004-3000-0000-0000-000000000004","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM eol_plans WHERE org_id = '11300000-3000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'non-member cannot read eol_plans'
);

-- 5. Caregiver CANNOT INSERT
SET LOCAL "request.jwt.claims" TO '{"sub":"bb220002-3000-0000-0000-000000000002","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO eol_plans (org_id, recipient_id, created_by)
    VALUES ('11300000-3000-0000-0000-000000000001','21300000-3000-0000-0000-000000000001',
            'bb220002-3000-0000-0000-000000000002')$$,
  '42501', NULL,
  'caregiver cannot insert eol_plans'
);

-- 6. Coordinator can upsert
SET LOCAL "request.jwt.claims" TO '{"sub":"aa110001-3000-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$INSERT INTO eol_plans (org_id, recipient_id, created_by, resuscitation_pref)
    VALUES ('11300000-3000-0000-0000-000000000001','21300000-3000-0000-0000-000000000001',
            'aa110001-3000-0000-0000-000000000001','full')
    ON CONFLICT (recipient_id) DO UPDATE SET resuscitation_pref = EXCLUDED.resuscitation_pref$$,
  'coordinator can upsert eol_plans'
);

-- 7. Coordinator can UPDATE
SELECT lives_ok(
  $$UPDATE eol_plans SET funeral_pref = 'Cremation' WHERE id = '31300000-3000-0000-0000-000000000001'$$,
  'coordinator can update eol_plans'
);

SELECT * FROM finish();
ROLLBACK;
