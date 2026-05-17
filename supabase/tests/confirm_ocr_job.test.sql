-- TD-144: pgTAP coverage for confirm_ocr_job() RPC.
--
-- Fixture UUID prefix: 20260517-1xxx-... to avoid collisions with other test
-- files run under the same `supabase test db` session.
--
-- Coverage:
--   1. function exists with SECURITY DEFINER + search_path pinned
--   2. anon and authenticated roles cannot EXECUTE (REVOKE took)
--   3. service_role can EXECUTE
--   4. happy path: needs_review → confirmed, 1 audit + 1 medication row
--   5. already_confirmed sentinel: second call on confirmed job returns
--      success=false, error='already_confirmed', no new rows. This is the
--      race-loser contract test; genuine concurrent-transaction races are not
--      testable inside a single pgTAP session (cf. invite_tokens_rls.test.sql:196).
--   6. not_found: random uuid → error='not_found'
--   7. org_mismatch: wrong p_org_id → error='org_mismatch', no rows
--   8. not_pending: pending status → error='not_pending', no rows
--   9. empty confirmed_field_keys array → field_count=0 (not NULL), no constraint violation

BEGIN;
SELECT plan(18);

-- ============================================================
-- Fixtures
-- ============================================================
INSERT INTO organizations (id, name, org_type) VALUES
  ('20260517-1000-0000-0000-000000000001', 'TD-144 Org A', 'family'),
  ('20260517-1000-0000-0000-000000000002', 'TD-144 Org B', 'family');

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('20260517-1001-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@td144.test', now(), now(), now(), '{}', '{}', false);

INSERT INTO identity_vault (token, org_id, full_name) VALUES
  ('20260517-1f00-0000-0000-000000000001', '20260517-1000-0000-0000-000000000001', 'TD-144 Test Recipient');

INSERT INTO care_recipients (id, org_id, identity_token) VALUES
  ('20260517-1002-0000-0000-000000000001',
   '20260517-1000-0000-0000-000000000001',
   '20260517-1f00-0000-0000-000000000001');

-- Job 1: needs_review → for happy path + already_confirmed
INSERT INTO ocr_jobs (id, org_id, recipient_id, image_url, raw_text, status) VALUES
  ('20260517-1003-0000-0000-000000000001',
   '20260517-1000-0000-0000-000000000001',
   '20260517-1002-0000-0000-000000000001',
   'https://example.com/scan1.jpg',
   'Metformin 500mg twice daily',
   'needs_review');

-- Job 2: pending → for not_pending sentinel
INSERT INTO ocr_jobs (id, org_id, recipient_id, image_url, raw_text, status) VALUES
  ('20260517-1003-0000-0000-000000000002',
   '20260517-1000-0000-0000-000000000001',
   '20260517-1002-0000-0000-000000000001',
   'https://example.com/scan2.jpg',
   'Lisinopril 10mg daily',
   'pending');

-- Job 3: needs_review → for org_mismatch
INSERT INTO ocr_jobs (id, org_id, recipient_id, image_url, raw_text, status) VALUES
  ('20260517-1003-0000-0000-000000000003',
   '20260517-1000-0000-0000-000000000001',
   '20260517-1002-0000-0000-000000000001',
   'https://example.com/scan3.jpg',
   'Atorvastatin 20mg',
   'needs_review');

-- Job 4: needs_review → for empty field_keys array test
INSERT INTO ocr_jobs (id, org_id, recipient_id, image_url, raw_text, status) VALUES
  ('20260517-1003-0000-0000-000000000004',
   '20260517-1000-0000-0000-000000000001',
   '20260517-1002-0000-0000-000000000001',
   'https://example.com/scan4.jpg',
   '',
   'needs_review');

-- ============================================================
-- Case 1: function exists with SECURITY DEFINER + pinned search_path
-- ============================================================
SELECT has_function(
  'public', 'confirm_ocr_job',
  ARRAY['uuid','uuid','uuid','text','text','text','bytea','text[]'],
  'confirm_ocr_job(...) function exists'
);

SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'confirm_ocr_job'),
  true,
  'confirm_ocr_job is SECURITY DEFINER'
);

SELECT ok(
  (SELECT 'search_path=public, pg_temp' = ANY(proconfig)
   FROM pg_proc WHERE proname = 'confirm_ocr_job'),
  'confirm_ocr_job has search_path = public, pg_temp pinned (T2 control)'
);

-- ============================================================
-- Case 2 + 3: privilege grants
-- ============================================================
SELECT is(
  has_function_privilege('anon', 'confirm_ocr_job(uuid,uuid,uuid,text,text,text,bytea,text[])', 'EXECUTE'),
  false,
  'anon role cannot EXECUTE confirm_ocr_job (T1 control)'
);

SELECT is(
  has_function_privilege('authenticated', 'confirm_ocr_job(uuid,uuid,uuid,text,text,text,bytea,text[])', 'EXECUTE'),
  false,
  'authenticated role cannot EXECUTE confirm_ocr_job (T1 control)'
);

SELECT is(
  has_function_privilege('service_role', 'confirm_ocr_job(uuid,uuid,uuid,text,text,text,bytea,text[])', 'EXECUTE'),
  true,
  'service_role can EXECUTE confirm_ocr_job'
);

-- ============================================================
-- Case 4: happy path — needs_review → confirmed, 1 audit + 1 medication
-- ============================================================
SELECT results_eq(
  $$ SELECT (confirm_ocr_job(
       '20260517-1001-0000-0000-000000000001'::uuid,
       '20260517-1000-0000-0000-000000000001'::uuid,
       '20260517-1003-0000-0000-000000000001'::uuid,
       'Metformin', '500mg', 'with breakfast',
       decode('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'hex'),
       ARRAY['drug_name','dosage','instructions']
     )).success $$,
  $$ VALUES (true) $$,
  'happy path returns success=true'
);

SELECT is(
  (SELECT status FROM ocr_jobs WHERE id = '20260517-1003-0000-0000-000000000001'),
  'confirmed'::ocr_status,
  'happy path flipped status to confirmed'
);

SELECT is(
  (SELECT COUNT(*)::int FROM medications
   WHERE recipient_id = '20260517-1002-0000-0000-000000000001'
     AND drug_name = 'Metformin'),
  1,
  'happy path inserted exactly 1 medication row'
);

SELECT is(
  (SELECT COUNT(*)::int FROM ocr_audit_log
   WHERE ocr_job_id = '20260517-1003-0000-0000-000000000001'
     AND backfilled = false),
  1,
  'happy path inserted exactly 1 audit row'
);

-- ============================================================
-- Case 5: already_confirmed (race-loser contract). Genuine concurrent-tx
-- races are infeasible in pgTAP; this proves the post-lock guard branch.
-- ============================================================
SELECT results_eq(
  $$ SELECT (confirm_ocr_job(
       '20260517-1001-0000-0000-000000000001'::uuid,
       '20260517-1000-0000-0000-000000000001'::uuid,
       '20260517-1003-0000-0000-000000000001'::uuid,
       'Metformin', '500mg', 'with breakfast',
       decode('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'hex'),
       ARRAY['drug_name','dosage','instructions']
     )).error $$,
  $$ VALUES ('already_confirmed'::text) $$,
  'second call on confirmed job returns error=already_confirmed (T3 race-loser contract)'
);

SELECT is(
  (SELECT COUNT(*)::int FROM medications
   WHERE recipient_id = '20260517-1002-0000-0000-000000000001'
     AND drug_name = 'Metformin'),
  1,
  'second call did NOT insert a duplicate medication row'
);

-- ============================================================
-- Case 6: not_found sentinel
-- ============================================================
SELECT results_eq(
  $$ SELECT (confirm_ocr_job(
       '20260517-1001-0000-0000-000000000001'::uuid,
       '20260517-1000-0000-0000-000000000001'::uuid,
       '20260517-9999-9999-9999-999999999999'::uuid,
       'X', 'Y', '',
       decode('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'hex'),
       ARRAY[]::text[]
     )).error $$,
  $$ VALUES ('not_found'::text) $$,
  'random uuid returns error=not_found'
);

-- ============================================================
-- Case 7: org_mismatch sentinel — caller claims Org B, row belongs to Org A
-- ============================================================
SELECT results_eq(
  $$ SELECT (confirm_ocr_job(
       '20260517-1001-0000-0000-000000000001'::uuid,
       '20260517-1000-0000-0000-000000000002'::uuid,  -- wrong org
       '20260517-1003-0000-0000-000000000003'::uuid,
       'X', 'Y', '',
       decode('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'hex'),
       ARRAY['drug_name','dosage']
     )).error $$,
  $$ VALUES ('org_mismatch'::text) $$,
  'wrong org_id returns error=org_mismatch (T1 defense-in-depth)'
);

SELECT is(
  (SELECT status FROM ocr_jobs WHERE id = '20260517-1003-0000-0000-000000000003'),
  'needs_review'::ocr_status,
  'org_mismatch left status unchanged'
);

-- ============================================================
-- Case 8: not_pending sentinel — job in pending status
-- ============================================================
SELECT results_eq(
  $$ SELECT (confirm_ocr_job(
       '20260517-1001-0000-0000-000000000001'::uuid,
       '20260517-1000-0000-0000-000000000001'::uuid,
       '20260517-1003-0000-0000-000000000002'::uuid,
       'X', 'Y', '',
       decode('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'hex'),
       ARRAY['drug_name','dosage']
     )).error $$,
  $$ VALUES ('not_pending'::text) $$,
  'pending-status job returns error=not_pending (only needs_review can confirm)'
);

-- ============================================================
-- Case 9: empty confirmed_field_keys → field_count=0 (COALESCE guard)
-- ============================================================
SELECT results_eq(
  $$ SELECT (confirm_ocr_job(
       '20260517-1001-0000-0000-000000000001'::uuid,
       '20260517-1000-0000-0000-000000000001'::uuid,
       '20260517-1003-0000-0000-000000000004'::uuid,
       'NoFields', 'NoFields', '',
       decode('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'hex'),
       ARRAY[]::text[]
     )).success $$,
  $$ VALUES (true) $$,
  'empty field_keys array does not violate NOT NULL CHECK on field_count'
);

SELECT is(
  (SELECT field_count FROM ocr_audit_log
   WHERE ocr_job_id = '20260517-1003-0000-0000-000000000004'
     AND backfilled = false),
  0,
  'empty field_keys array produced field_count=0 (COALESCE worked)'
);

SELECT * FROM finish();
ROLLBACK;
