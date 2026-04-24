BEGIN;
SELECT plan(17);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

-- Users: alice (coordinator), bob (caregiver), eve (outsider, different org)
INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aa460001-4600-0000-0000-000000000001', 'authenticated', 'authenticated',
   'alice@medtag-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bb460002-4600-0000-0000-000000000002', 'authenticated', 'authenticated',
   'bob@medtag-rls.com', now(), now(), now(), '{}', '{}', false),
  ('ee460003-4600-0000-0000-000000000003', 'authenticated', 'authenticated',
   'eve@medtag-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

-- Orgs
INSERT INTO organizations (id, name, org_type)
VALUES
  ('org46000a-4600-0000-0000-000000000001', 'MedTag Org A', 'family'),
  ('org46000b-4600-0000-0000-000000000002', 'MedTag Org B', 'family')
ON CONFLICT DO NOTHING;

-- Care recipient for org A (required for medications + care_events)
INSERT INTO identity_vault (org_id, full_name)
VALUES ('org46000a-4600-0000-0000-000000000001', 'Tag Test Recipient')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT 'rec46000a-4600-0000-0000-000000000001', 'org46000a-4600-0000-0000-000000000001', token
FROM identity_vault WHERE org_id = 'org46000a-4600-0000-0000-000000000001' LIMIT 1
ON CONFLICT DO NOTHING;

-- Memberships: alice (coordinator) + bob (caregiver) in org A; eve in org B
INSERT INTO memberships (org_id, user_id, role, accepted_at)
VALUES
  ('org46000a-4600-0000-0000-000000000001', 'aa460001-4600-0000-0000-000000000001', 'coordinator', now()),
  ('org46000a-4600-0000-0000-000000000001', 'bb460002-4600-0000-0000-000000000002', 'caregiver',   now()),
  ('org46000b-4600-0000-0000-000000000002', 'ee460003-4600-0000-0000-000000000003', 'caregiver',   now())
ON CONFLICT DO NOTHING;

-- Fixture medication (bypass RLS as postgres)
INSERT INTO medications (id, org_id, recipient_id, drug_name, dosage, scan_source, active)
VALUES (
  'med46000a-4600-0000-0000-000000000001',
  'org46000a-4600-0000-0000-000000000001',
  'rec46000a-4600-0000-0000-000000000001',
  'Lisinopril', '10mg daily', 'manual', true
) ON CONFLICT DO NOTHING;

-- Fixture care event (bypass RLS as postgres)
INSERT INTO care_events (id, org_id, recipient_id, actor_id, event_type, entry_kind, payload)
VALUES (
  'cev46000a-4600-0000-0000-000000000001',
  'org46000a-4600-0000-0000-000000000001',
  'rec46000a-4600-0000-0000-000000000001',
  'aa460001-4600-0000-0000-000000000001',
  'journal', 'human', '{"text":"test entry"}'
) ON CONFLICT DO NOTHING;

-- Fixture document (bypass RLS as postgres)
INSERT INTO documents (id, org_id, recipient_id, uploaded_by, display_name, doc_type, storage_path)
VALUES (
  'doc46000a-4600-0000-0000-000000000001',
  'org46000a-4600-0000-0000-000000000001',
  'rec46000a-4600-0000-0000-000000000001',
  'aa460001-4600-0000-0000-000000000001',
  'Test Doc', 'other', 'test/doc.pdf'
) ON CONFLICT DO NOTHING;

-- Fixture care_event_medications row (tagged_by = bob, for DELETE tests)
INSERT INTO care_event_medications (id, care_event_id, medication_id, org_id, confidence, tagged_by)
VALUES (
  'cem46001a-4600-0000-0000-000000000001',
  'cev46000a-4600-0000-0000-000000000001',
  'med46000a-4600-0000-0000-000000000001',
  'org46000a-4600-0000-0000-000000000001',
  'manual',
  'bb460002-4600-0000-0000-000000000002'
) ON CONFLICT DO NOTHING;

-- Fixture document_medications row (for DELETE tests — coordinator only)
INSERT INTO document_medications (id, document_id, medication_id, org_id, confidence, tagged_by)
VALUES (
  'dm460001a-4600-0000-0000-000000000001',
  'doc46000a-4600-0000-0000-000000000001',
  'med46000a-4600-0000-0000-000000000001',
  'org46000a-4600-0000-0000-000000000001',
  'auto',
  'aa460001-4600-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- ─── care_event_medications tests ────────────────────────────────────────────

-- 1. Org member (bob) can SELECT care_event_medications
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"bb460002-4600-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM care_event_medications WHERE org_id = 'org46000a-4600-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'org member (caregiver) can SELECT care_event_medications'
);

-- 2. Non-member (eve) cannot SELECT care_event_medications
SET LOCAL "request.jwt.claims" TO '{"sub":"ee460003-4600-0000-0000-000000000003","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM care_event_medications WHERE org_id = 'org46000a-4600-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'non-member cannot SELECT care_event_medications'
);

-- 3. Org member (bob) can INSERT a manual tag on care_event_medications
SET LOCAL "request.jwt.claims" TO '{"sub":"bb460002-4600-0000-0000-000000000002","role":"authenticated"}';

SELECT lives_ok(
  $$INSERT INTO care_event_medications (care_event_id, medication_id, org_id, confidence, tagged_by)
    VALUES (
      'cev46000a-4600-0000-0000-000000000001',
      'med46000a-4600-0000-0000-000000000001',
      'org46000a-4600-0000-0000-000000000001',
      'manual',
      'bb460002-4600-0000-0000-000000000002'
    )$$,
  'org member (caregiver) can INSERT care_event_medications'
);

-- 4. Non-member (eve) cannot INSERT care_event_medications
SET LOCAL "request.jwt.claims" TO '{"sub":"ee460003-4600-0000-0000-000000000003","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO care_event_medications (care_event_id, medication_id, org_id, confidence, tagged_by)
    VALUES (
      'cev46000a-4600-0000-0000-000000000001',
      'med46000a-4600-0000-0000-000000000001',
      'org46000a-4600-0000-0000-000000000001',
      'manual',
      'ee460003-4600-0000-0000-000000000003'
    )$$,
  '42501', NULL,
  'non-member cannot INSERT care_event_medications'
);

-- 5. Tagger (bob) can DELETE their own care_event_medications row
SET LOCAL "request.jwt.claims" TO '{"sub":"bb460002-4600-0000-0000-000000000002","role":"authenticated"}';

SELECT lives_ok(
  $$DELETE FROM care_event_medications WHERE id = 'cem46001a-4600-0000-0000-000000000001'$$,
  'tagger (bob) can DELETE their own care_event_medications row'
);

-- Verify it was actually deleted
SELECT results_eq(
  $$SELECT count(*)::int FROM care_event_medications WHERE id = 'cem46001a-4600-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'tagger DELETE actually removed the row'
);

-- Re-insert the row as postgres for coordinator DELETE test
SET LOCAL ROLE postgres;
INSERT INTO care_event_medications (id, care_event_id, medication_id, org_id, confidence, tagged_by)
VALUES (
  'cem46001a-4600-0000-0000-000000000001',
  'cev46000a-4600-0000-0000-000000000001',
  'med46000a-4600-0000-0000-000000000001',
  'org46000a-4600-0000-0000-000000000001',
  'manual',
  'bb460002-4600-0000-0000-000000000002'
) ON CONFLICT DO NOTHING;

-- 6. Coordinator (alice) can DELETE any care_event_medications row
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa460001-4600-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$DELETE FROM care_event_medications WHERE id = 'cem46001a-4600-0000-0000-000000000001'$$,
  'coordinator can DELETE care_event_medications row (not their own tag)'
);

SELECT results_eq(
  $$SELECT count(*)::int FROM care_event_medications WHERE id = 'cem46001a-4600-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'coordinator DELETE actually removed the row'
);

-- Re-insert for non-tagger/non-coordinator DELETE test
SET LOCAL ROLE postgres;
INSERT INTO care_event_medications (id, care_event_id, medication_id, org_id, confidence, tagged_by)
VALUES (
  'cem46001a-4600-0000-0000-000000000001',
  'cev46000a-4600-0000-0000-000000000001',
  'med46000a-4600-0000-0000-000000000001',
  'org46000a-4600-0000-0000-000000000001',
  'manual',
  'aa460001-4600-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- 7. Non-tagger non-coordinator (bob) cannot DELETE a row tagged by alice
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"bb460002-4600-0000-0000-000000000002","role":"authenticated"}';

SELECT lives_ok(
  $$DELETE FROM care_event_medications WHERE id = 'cem46001a-4600-0000-0000-000000000001'$$,
  'non-tagger non-coordinator DELETE does not throw (RLS silently skips)'
);

SELECT results_eq(
  $$SELECT count(*)::int FROM care_event_medications WHERE id = 'cem46001a-4600-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'non-tagger non-coordinator DELETE silently skipped — row still exists'
);

-- ─── document_medications tests ──────────────────────────────────────────────

-- 8. Org member (bob/caregiver) can SELECT document_medications
SET LOCAL "request.jwt.claims" TO '{"sub":"bb460002-4600-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM document_medications WHERE org_id = 'org46000a-4600-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'org member (caregiver) can SELECT document_medications'
);

-- 9. Non-member (eve) cannot SELECT document_medications
SET LOCAL "request.jwt.claims" TO '{"sub":"ee460003-4600-0000-0000-000000000003","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM document_medications WHERE org_id = 'org46000a-4600-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'non-member cannot SELECT document_medications'
);

-- 10. Coordinator (alice) can INSERT document_medications
SET LOCAL "request.jwt.claims" TO '{"sub":"aa460001-4600-0000-0000-000000000001","role":"authenticated"}';

-- Delete the fixture first so INSERT doesn't hit the UNIQUE constraint
SET LOCAL ROLE postgres;
DELETE FROM document_medications WHERE id = 'dm460001a-4600-0000-0000-000000000001';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa460001-4600-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$INSERT INTO document_medications (document_id, medication_id, org_id, confidence, tagged_by)
    VALUES (
      'doc46000a-4600-0000-0000-000000000001',
      'med46000a-4600-0000-0000-000000000001',
      'org46000a-4600-0000-0000-000000000001',
      'manual',
      'aa460001-4600-0000-0000-000000000001'
    )$$,
  'coordinator can INSERT document_medications'
);

-- 11. Non-coordinator (bob/caregiver) cannot INSERT document_medications
SET LOCAL "request.jwt.claims" TO '{"sub":"bb460002-4600-0000-0000-000000000002","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO document_medications (document_id, medication_id, org_id, confidence, tagged_by)
    VALUES (
      'doc46000a-4600-0000-0000-000000000001',
      'med46000a-4600-0000-0000-000000000001',
      'org46000a-4600-0000-0000-000000000001',
      'manual',
      'bb460002-4600-0000-0000-000000000002'
    )$$,
  '42501', NULL,
  'non-coordinator (caregiver) cannot INSERT document_medications'
);

-- 12. Coordinator (alice) can DELETE document_medications
SET LOCAL "request.jwt.claims" TO '{"sub":"aa460001-4600-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$DELETE FROM document_medications
    WHERE document_id = 'doc46000a-4600-0000-0000-000000000001'
      AND medication_id = 'med46000a-4600-0000-0000-000000000001'$$,
  'coordinator can DELETE document_medications'
);

-- Re-insert for non-coordinator DELETE test
SET LOCAL ROLE postgres;
INSERT INTO document_medications (id, document_id, medication_id, org_id, confidence, tagged_by)
VALUES (
  'dm460001a-4600-0000-0000-000000000001',
  'doc46000a-4600-0000-0000-000000000001',
  'med46000a-4600-0000-0000-000000000001',
  'org46000a-4600-0000-0000-000000000001',
  'auto',
  'aa460001-4600-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- 13. Non-coordinator (bob/caregiver) cannot DELETE document_medications
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"bb460002-4600-0000-0000-000000000002","role":"authenticated"}';

SELECT lives_ok(
  $$DELETE FROM document_medications WHERE id = 'dm460001a-4600-0000-0000-000000000001'$$,
  'non-coordinator DELETE does not throw (RLS silently skips)'
);

SELECT results_eq(
  $$SELECT count(*)::int FROM document_medications WHERE id = 'dm460001a-4600-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'non-coordinator DELETE silently skipped — row still exists'
);

SELECT * FROM finish();
ROLLBACK;
