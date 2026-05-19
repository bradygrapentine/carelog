-- TD-179: pgTAP coverage for update_emergency_info() RPC.
--
-- Fixture UUID prefix: 20260518-2xxx-... to avoid collisions with other
-- test files run under the same `supabase test db` session.
--
-- Coverage (plan(15)):
--   1. function exists with SECURITY DEFINER + search_path pinned
--   2. privilege grants — anon/authenticated revoked, service_role granted
--   3. happy path: merged jsonb returned, both keys present
--   4. recipient_not_found via cross-org access (recipient in Org A, caller passes Org B)
--   5. recipient_not_found via unknown recipient_id
--   6. jsonb_strip_nulls clears a key when patch sets it to null
--   7. null value for absent key is a no-op
--   8. idempotent: same patch twice → identical state
--   9. disjoint-keys serial merge: two patches with different keys → both keys present
--      (NOT true concurrency — pgTAP single-backend can't simulate concurrent txns;
--       true-concurrency integration test is deferred outside this sprint)

BEGIN;
SELECT plan(16);

-- ============================================================
-- Fixtures
-- ============================================================
INSERT INTO organizations (id, name, org_type) VALUES
  ('20260518-2000-0000-0000-000000000001', 'TD-179 Org A', 'family'),
  ('20260518-2000-0000-0000-000000000002', 'TD-179 Org B', 'family');

INSERT INTO identity_vault (token, org_id, full_name, contact_info) VALUES
  ('20260518-2f00-0000-0000-000000000001',
   '20260518-2000-0000-0000-000000000001',
   'TD-179 Recipient A',
   '{}'::jsonb);

INSERT INTO care_recipients (id, org_id, identity_token) VALUES
  ('20260518-2002-0000-0000-000000000001',
   '20260518-2000-0000-0000-000000000001',
   '20260518-2f00-0000-0000-000000000001');

-- ============================================================
-- Case 1: function exists with SECURITY DEFINER + pinned search_path
-- ============================================================
SELECT has_function(
  'public', 'update_emergency_info',
  ARRAY['uuid','uuid','jsonb'],
  'update_emergency_info(...) function exists'
);

SELECT is(
  (SELECT prosecdef FROM pg_proc
   WHERE proname = 'update_emergency_info'
     AND pronamespace = 'public'::regnamespace),
  true,
  'update_emergency_info is SECURITY DEFINER'
);

SELECT ok(
  (SELECT 'search_path=public, pg_temp' = ANY(proconfig)
   FROM pg_proc
   WHERE proname = 'update_emergency_info'
     AND pronamespace = 'public'::regnamespace),
  'update_emergency_info has search_path = public, pg_temp pinned (CVE-2018-1058 control)'
);

-- ============================================================
-- Case 2: privilege grants
-- ============================================================
SELECT is(
  has_function_privilege('anon', 'update_emergency_info(uuid,uuid,jsonb)', 'EXECUTE'),
  false,
  'anon role cannot EXECUTE update_emergency_info'
);

SELECT is(
  has_function_privilege('authenticated', 'update_emergency_info(uuid,uuid,jsonb)', 'EXECUTE'),
  false,
  'authenticated role cannot EXECUTE update_emergency_info'
);

SELECT is(
  has_function_privilege('service_role', 'update_emergency_info(uuid,uuid,jsonb)', 'EXECUTE'),
  true,
  'service_role can EXECUTE update_emergency_info'
);

-- ============================================================
-- Case 3: happy path — patch merges, both keys present
-- ============================================================
SELECT results_eq(
  $$ SELECT update_emergency_info(
       '20260518-2000-0000-0000-000000000001'::uuid,
       '20260518-2002-0000-0000-000000000001'::uuid,
       '{"dnr_status": "DNR", "hospital": "Memorial"}'::jsonb
     ) $$,
  $$ VALUES ('{"hospital": "Memorial", "dnr_status": "DNR"}'::jsonb) $$,
  'happy path: returns merged jsonb with both keys'
);

-- ============================================================
-- Case 4: cross-org access — recipient in Org A, caller passes Org B
-- ============================================================
SELECT throws_ok(
  $$ SELECT update_emergency_info(
       '20260518-2000-0000-0000-000000000002'::uuid,
       '20260518-2002-0000-0000-000000000001'::uuid,
       '{"dnr_status": "DNR"}'::jsonb
     ) $$,
  'P0002',
  'recipient_not_found',
  'cross-org access raises recipient_not_found (P0002)'
);

-- ============================================================
-- Case 5: unknown recipient_id
-- ============================================================
SELECT throws_ok(
  $$ SELECT update_emergency_info(
       '20260518-2000-0000-0000-000000000001'::uuid,
       '20260518-9999-9999-9999-999999999999'::uuid,
       '{"dnr_status": "DNR"}'::jsonb
     ) $$,
  'P0002',
  'recipient_not_found',
  'unknown recipient_id raises recipient_not_found (P0002)'
);

-- ============================================================
-- Case 6: jsonb_strip_nulls clears a key when patch sets it to null
-- Starting state from Case 3: {"dnr_status": "DNR", "hospital": "Memorial"}
-- ============================================================
SELECT results_eq(
  $$ SELECT update_emergency_info(
       '20260518-2000-0000-0000-000000000001'::uuid,
       '20260518-2002-0000-0000-000000000001'::uuid,
       '{"dnr_status": null}'::jsonb
     ) $$,
  $$ VALUES ('{"hospital": "Memorial"}'::jsonb) $$,
  'null value strips key from merged result (jsonb_strip_nulls semantic)'
);

-- ============================================================
-- Case 7: null value for absent key is a no-op
-- Current state: {"hospital": "Memorial"}; patch clears already-absent key.
-- ============================================================
SELECT results_eq(
  $$ SELECT update_emergency_info(
       '20260518-2000-0000-0000-000000000001'::uuid,
       '20260518-2002-0000-0000-000000000001'::uuid,
       '{"dnr_status": null}'::jsonb
     ) $$,
  $$ VALUES ('{"hospital": "Memorial"}'::jsonb) $$,
  'null patch for absent key is a no-op'
);

-- ============================================================
-- Case 8: idempotent re-application
-- ============================================================
SELECT results_eq(
  $$ SELECT update_emergency_info(
       '20260518-2000-0000-0000-000000000001'::uuid,
       '20260518-2002-0000-0000-000000000001'::uuid,
       '{"hospital": "St. Mary"}'::jsonb
     ) $$,
  $$ VALUES ('{"hospital": "St. Mary"}'::jsonb) $$,
  'first apply of {hospital: St. Mary}'
);

SELECT results_eq(
  $$ SELECT update_emergency_info(
       '20260518-2000-0000-0000-000000000001'::uuid,
       '20260518-2002-0000-0000-000000000001'::uuid,
       '{"hospital": "St. Mary"}'::jsonb
     ) $$,
  $$ VALUES ('{"hospital": "St. Mary"}'::jsonb) $$,
  'second apply yields identical state (idempotent)'
);

-- ============================================================
-- Case 9: disjoint-keys serial merge — two patches with different keys both
-- land in the final state. NOT a true-concurrency simulation; documents the
-- shallow top-level merge semantic preserves disjoint keys across calls.
--
-- TD-191 item 5: explicit pre-state assertion. Case 9 used to implicitly
-- depend on Case 6 having cleared `dnr_status`; reordering or removing
-- earlier cases would silently break the disjoint-keys narrative. Assert
-- the pre-state here so the case is self-contained.
-- ============================================================
SELECT results_eq(
  $$ SELECT (contact_info ? 'dnr_status') AS dnr_present
     FROM identity_vault
     WHERE token = (
       SELECT identity_token FROM care_recipients
       WHERE id = '20260518-2002-0000-0000-000000000001'::uuid
     ) $$,
  $$ VALUES (false) $$,
  'Case 9 pre-state: dnr_status key absent before patch A applies'
);

SELECT lives_ok(
  $$ SELECT update_emergency_info(
       '20260518-2000-0000-0000-000000000001'::uuid,
       '20260518-2002-0000-0000-000000000001'::uuid,
       '{"dnr_status": "DNR"}'::jsonb
     ) $$,
  'patch A applies'
);

SELECT results_eq(
  $$ SELECT update_emergency_info(
       '20260518-2000-0000-0000-000000000001'::uuid,
       '20260518-2002-0000-0000-000000000001'::uuid,
       '{"primary_contact": {"name": "Alex"}}'::jsonb
     ) $$,
  $$ VALUES ('{"hospital": "St. Mary", "dnr_status": "DNR", "primary_contact": {"name": "Alex"}}'::jsonb) $$,
  'patch B merges with A — all three disjoint keys present (shallow merge)'
);

SELECT * FROM finish();
ROLLBACK;
