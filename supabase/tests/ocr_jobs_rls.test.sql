-- supabase/tests/ocr_jobs_rls.test.sql
--
-- Verifies RLS on ocr_jobs including columns added by
-- 20260413000100_ocr_jobs_category_created_by.sql (category, created_by).
--
-- Policy: "ocr jobs by team" FOR ALL USING (user_can_access_recipient(recipient_id))

BEGIN;
SELECT plan(5);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('ee050001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@ocr-rls.com', now(), now(), now(), '{}', '{}', false),
  ('ff060002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'caregiver@ocr-rls.com', now(), now(), now(), '{}', '{}', false),
  ('aa070003-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'outsider@ocr-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('30000000-0000-0000-0000-000000000001', 'OCR RLS Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (org_id, full_name)
VALUES ('30000000-0000-0000-0000-000000000001', 'OCR Test Recipient')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', token
FROM identity_vault WHERE org_id = '30000000-0000-0000-0000-000000000001' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
VALUES
  ('30000000-0000-0000-0000-000000000001',
   'ee050001-0000-0000-0000-000000000001',
   'coordinator', now(), null),
  ('30000000-0000-0000-0000-000000000001',
   'ff060002-0000-0000-0000-000000000002',
   'caregiver', now(), '40000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Fixture OCR job with category + created_by (columns from the migration)
INSERT INTO ocr_jobs (id, org_id, recipient_id, image_url, status, category, created_by)
VALUES (
  '60000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  'https://example.com/rx.jpg',
  'pending',
  'prescription',
  'ee050001-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Coordinator can SELECT ocr_jobs for their recipient
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"ee050001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM ocr_jobs WHERE recipient_id = '40000000-0000-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'coordinator can SELECT ocr_jobs for their recipient'
);

-- 2. Caregiver with recipient access can SELECT ocr_jobs
SET LOCAL "request.jwt.claims" TO '{"sub":"ff060002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM ocr_jobs WHERE recipient_id = '40000000-0000-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'caregiver with recipient access can SELECT ocr_jobs'
);

-- 3. Outsider CANNOT SELECT ocr_jobs (no membership)
SET LOCAL "request.jwt.claims" TO '{"sub":"aa070003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM ocr_jobs WHERE recipient_id = '40000000-0000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'outsider cannot SELECT ocr_jobs (RLS blocks)'
);

-- 4. Outsider CANNOT INSERT an ocr_job
SELECT throws_ok(
  $$INSERT INTO ocr_jobs (org_id, recipient_id, image_url, status, category, created_by)
    VALUES (
      '30000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      'https://evil.com/rx.jpg',
      'pending',
      'prescription',
      'aa070003-0000-0000-0000-000000000003'
    )$$,
  '42501', NULL,
  'outsider cannot INSERT ocr_job'
);

-- 5. category column exists and is readable by coordinator
SET LOCAL "request.jwt.claims" TO '{"sub":"ee050001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT category FROM ocr_jobs WHERE id = '60000000-0000-0000-0000-000000000001'$$,
  ARRAY['prescription'],
  'category column is accessible and correct for coordinator'
);

SELECT * FROM finish();
ROLLBACK;
