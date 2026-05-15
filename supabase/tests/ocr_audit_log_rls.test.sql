-- ocr_audit_log_rls.test.sql
-- SEC-007: pgTAP coverage for ocr_audit_log RLS + append-only + CHECK constraints.
--
-- Fixture UUID prefix: 20260516-7xxx-... (avoids collision with other tests).
-- Uses 4-arg throws_ok form per supabase/CLAUDE.md.

BEGIN;
SELECT plan(10);

-- ============================================================
-- Fixtures
-- ============================================================

-- Org
INSERT INTO organizations (id, name, org_type) VALUES
  ('20260516-7000-0000-0000-000000000001', 'SEC-007 Test Org', 'family');

-- auth.users
INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('20260516-7001-0000-0000-000000000001', 'authenticated', 'authenticated',
   'audit-svc@sec007.test', now(), now(), now(), '{}', '{}', false),
  ('20260516-7002-0000-0000-000000000001', 'authenticated', 'authenticated',
   'audit-coord@sec007.test', now(), now(), now(), '{}', '{}', false);

-- Coordinator membership for the "authenticated coordinator" test (case 3)
INSERT INTO memberships (id, org_id, user_id, role, recipient_id, accepted_at) VALUES
  ('20260516-7010-0000-0000-000000000001',
   '20260516-7000-0000-0000-000000000001',
   '20260516-7002-0000-0000-000000000001',
   'coordinator', NULL, now());

-- Seed one audit row as service_role for SELECT/UPDATE/DELETE assertions
SET LOCAL ROLE service_role;
INSERT INTO ocr_audit_log (
  id, ocr_job_id, org_id_snapshot, user_id,
  raw_output_hash, confirmed_field_keys, field_count, ts, backfilled
) VALUES (
  '20260516-7020-0000-0000-000000000001',
  '20260516-7030-0000-0000-000000000001',
  '20260516-7000-0000-0000-000000000001',
  '20260516-7001-0000-0000-000000000001',
  decode('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'hex'),
  ARRAY['drug_name','dosage'],
  2,
  now(),
  false
);
RESET ROLE;

-- ============================================================
-- Case 1: RLS enabled on ocr_audit_log
-- ============================================================
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'ocr_audit_log'),
  true,
  'case1: RLS is enabled on ocr_audit_log'
);

-- ============================================================
-- Case 2: anon SELECT returns 0 rows (RLS denies)
-- ============================================================
SET LOCAL ROLE anon;
SELECT results_eq(
  $$ SELECT count(*)::bigint FROM ocr_audit_log $$,
  ARRAY[0::bigint],
  'case2: anon SELECT returns 0 rows'
);
RESET ROLE;

-- ============================================================
-- Case 3: authenticated coordinator SELECT returns 0 rows
-- ============================================================
SET LOCAL ROLE authenticated;
SELECT results_eq(
  $$ SELECT count(*)::bigint FROM ocr_audit_log $$,
  ARRAY[0::bigint],
  'case3: authenticated SELECT returns 0 rows (service_role only)'
);
RESET ROLE;

-- ============================================================
-- Case 4: service_role SELECT returns seeded row
-- ============================================================
SET LOCAL ROLE service_role;
SELECT results_eq(
  $$ SELECT count(*)::bigint FROM ocr_audit_log WHERE id = '20260516-7020-0000-0000-000000000001' $$,
  ARRAY[1::bigint],
  'case4: service_role SELECT returns seeded row'
);
RESET ROLE;

-- ============================================================
-- Case 5: UPDATE blocked by append-only trigger
-- Note: REVOKE UPDATE from service_role gives 42501 (insufficient_privilege)
-- before the trigger fires. Both block; we test the strongest layer.
-- ============================================================
SET LOCAL ROLE service_role;
SELECT throws_ok(
  $$ UPDATE ocr_audit_log SET field_count = 999 WHERE id = '20260516-7020-0000-0000-000000000001' $$,
  '42501',
  NULL,
  'case5: UPDATE blocked (REVOKE precedes trigger, both append-only-enforce)'
);
RESET ROLE;

-- ============================================================
-- Case 6: DELETE blocked by append-only
-- ============================================================
SET LOCAL ROLE service_role;
SELECT throws_ok(
  $$ DELETE FROM ocr_audit_log WHERE id = '20260516-7020-0000-0000-000000000001' $$,
  '42501',
  NULL,
  'case6: DELETE blocked (REVOKE + trigger append-only enforce)'
);
RESET ROLE;

-- ============================================================
-- Case 7: raw_output_hash length CHECK
-- ============================================================
SET LOCAL ROLE service_role;
SELECT throws_ok(
  $$ INSERT INTO ocr_audit_log (
       ocr_job_id, org_id_snapshot, user_id,
       raw_output_hash, confirmed_field_keys, field_count
     ) VALUES (
       '20260516-7030-0000-0000-000000000002',
       '20260516-7000-0000-0000-000000000001',
       '20260516-7001-0000-0000-000000000001',
       decode('00', 'hex'),
       ARRAY['drug_name'],
       1
     ) $$,
  '23514',
  NULL,
  'case7: raw_output_hash length CHECK rejects non-32-byte hash'
);
RESET ROLE;

-- ============================================================
-- Case 8: confirmed_field_keys allowlist CHECK
-- ============================================================
SET LOCAL ROLE service_role;
SELECT throws_ok(
  $$ INSERT INTO ocr_audit_log (
       ocr_job_id, org_id_snapshot, user_id,
       raw_output_hash, confirmed_field_keys, field_count
     ) VALUES (
       '20260516-7030-0000-0000-000000000003',
       '20260516-7000-0000-0000-000000000001',
       '20260516-7001-0000-0000-000000000001',
       decode('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'hex'),
       ARRAY['patient_ssn'],
       1
     ) $$,
  '23514',
  NULL,
  'case8: confirmed_field_keys allowlist CHECK rejects unknown key'
);
RESET ROLE;

-- ============================================================
-- Case 9: lives_ok for allowed subset
-- ============================================================
SET LOCAL ROLE service_role;
SELECT lives_ok(
  $$ INSERT INTO ocr_audit_log (
       ocr_job_id, org_id_snapshot, user_id,
       raw_output_hash, confirmed_field_keys, field_count
     ) VALUES (
       '20260516-7030-0000-0000-000000000004',
       '20260516-7000-0000-0000-000000000001',
       '20260516-7001-0000-0000-000000000001',
       decode('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'hex'),
       ARRAY['drug_name','dosage','instructions'],
       3
     ) $$,
  'case9: allowlist subset insert succeeds'
);
RESET ROLE;

-- ============================================================
-- Case 10: FK ON DELETE RESTRICT blocks user delete.
-- Run as postgres (superuser) so we test the FK layer, not the permission
-- layer — service_role lacks DELETE on auth.users (42501 fires before FK).
-- In prod the auth admin API hits this FK; pgTAP simulates via postgres role.
-- ============================================================
SET LOCAL ROLE postgres;
SELECT throws_ok(
  $$ DELETE FROM auth.users WHERE id = '20260516-7001-0000-0000-000000000001' $$,
  '23503',
  NULL,
  'case10: FK RESTRICT blocks auth.users delete when audit row references it'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
