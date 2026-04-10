BEGIN;
SELECT plan(6);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aa110001-2000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@doc-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bb220002-2000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'caregiver@doc-rls.com', now(), now(), now(), '{}', '{}', false),
  ('cc330003-2000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'supporter@doc-rls.com', now(), now(), now(), '{}', '{}', false),
  ('dd440004-2000-0000-0000-000000000004', 'authenticated', 'authenticated',
   'outsider@doc-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('11200000-2000-0000-0000-000000000001', 'Doc RLS Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (org_id, full_name)
VALUES ('11200000-2000-0000-0000-000000000001', 'Doc Test Recipient')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT '21200000-2000-0000-0000-000000000001', '11200000-2000-0000-0000-000000000001', token
FROM identity_vault WHERE org_id = '11200000-2000-0000-0000-000000000001' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
VALUES
  ('11200000-2000-0000-0000-000000000001', 'aa110001-2000-0000-0000-000000000001', 'coordinator', now(), null),
  ('11200000-2000-0000-0000-000000000001', 'bb220002-2000-0000-0000-000000000002', 'caregiver',   now(), '21200000-2000-0000-0000-000000000001'),
  ('11200000-2000-0000-0000-000000000001', 'cc330003-2000-0000-0000-000000000003', 'supporter',   now(), null)
ON CONFLICT DO NOTHING;

-- Fixture document — inserted as postgres to bypass RLS
INSERT INTO documents (id, org_id, recipient_id, uploaded_by, display_name, doc_type, storage_path)
VALUES (
  '31200000-2000-0000-0000-000000000001',
  '11200000-2000-0000-0000-000000000001',
  '21200000-2000-0000-0000-000000000001',
  'aa110001-2000-0000-0000-000000000001',
  'Power of Attorney', 'power_of_attorney', 'test/poa.pdf'
) ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Coordinator can INSERT
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa110001-2000-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$INSERT INTO documents (org_id, recipient_id, uploaded_by, display_name, doc_type, storage_path)
    VALUES ('11200000-2000-0000-0000-000000000001','21200000-2000-0000-0000-000000000001',
            'aa110001-2000-0000-0000-000000000001','HIPAA Auth','hipaa_authorization','test/hipaa.pdf')$$,
  'coordinator can insert a document'
);

-- 2. Caregiver CANNOT INSERT
SET LOCAL "request.jwt.claims" TO '{"sub":"bb220002-2000-0000-0000-000000000002","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO documents (org_id, recipient_id, uploaded_by, display_name, doc_type, storage_path)
    VALUES ('11200000-2000-0000-0000-000000000001','21200000-2000-0000-0000-000000000001',
            'bb220002-2000-0000-0000-000000000002','Meds List','medication_list','test/meds.pdf')$$,
  '42501', NULL,
  'caregiver cannot insert a document'
);

-- 3. Coordinator can SELECT
SET LOCAL "request.jwt.claims" TO '{"sub":"aa110001-2000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM documents WHERE org_id = '11200000-2000-0000-0000-000000000001'$$,
  ARRAY[2]::int[],
  'coordinator can read documents for their org'
);

-- 4. Supporter can SELECT (read-only)
SET LOCAL "request.jwt.claims" TO '{"sub":"cc330003-2000-0000-0000-000000000003","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM documents WHERE org_id = '11200000-2000-0000-0000-000000000001'$$,
  ARRAY[2]::int[],
  'supporter can read documents for their org'
);

-- 5. Outsider sees 0 rows
SET LOCAL "request.jwt.claims" TO '{"sub":"dd440004-2000-0000-0000-000000000004","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM documents WHERE org_id = '11200000-2000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'non-member cannot read documents'
);

-- 6. Coordinator can DELETE
SET LOCAL "request.jwt.claims" TO '{"sub":"aa110001-2000-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$DELETE FROM documents WHERE id = '31200000-2000-0000-0000-000000000001'$$,
  'coordinator can delete a document'
);

SELECT * FROM finish();
ROLLBACK;
