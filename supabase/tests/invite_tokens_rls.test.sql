-- invite_tokens_rls.test.sql
-- OOP-001: pgTAP coverage for accept_invite() atomicity, expiry, and email normalization.
--
-- Fixture UUID prefix: 20260514-2xxx-... (Track 2 contract; Track 1 uses prefix 1xxx).
-- This prevents fixture collisions when both files run under the same `supabase test db` session.
--
-- accept_invite(p_token text, p_user_id uuid, p_email text) returns invite_accept_result(success boolean, error text)
-- 3 documented error paths: not_found | email_mismatch | already_used
-- Expiry maps to not_found (function SELECTs WHERE expires_at > now()).

BEGIN;
SELECT plan(10);

-- ============================================================
-- Fixtures
-- ============================================================
INSERT INTO organizations (id, name, org_type) VALUES
  ('20260514-2000-0000-0000-000000000001', 'OOP-001 Test Org', 'family');

-- auth.users rows must be inserted before memberships due to FK chain.
-- The handle_new_user trigger auto-creates user_profiles rows.
INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  -- User who will accept the happy-path invite
  ('20260514-2001-0000-0000-000000000001', 'authenticated', 'authenticated',
   'alice@oop001.test', now(), now(), now(), '{}', '{}', false),
  -- User for email-normalization test (lowercased email)
  ('20260514-2002-0000-0000-000000000001', 'authenticated', 'authenticated',
   'bob@oop001.test', now(), now(), now(), '{}', '{}', false),
  -- User for already_used test (separate from happy-path to avoid state leak)
  ('20260514-2003-0000-0000-000000000001', 'authenticated', 'authenticated',
   'carol@oop001.test', now(), now(), now(), '{}', '{}', false);

-- Memberships (pending — user_id NULL until invite accepted)
INSERT INTO memberships (id, org_id, user_id, role, recipient_id) VALUES
  -- membership for happy-path token
  ('20260514-2010-0000-0000-000000000001',
   '20260514-2000-0000-0000-000000000001', NULL, 'caregiver', NULL),
  -- membership for expired-token test (token will have past expires_at)
  ('20260514-2010-0000-0000-000000000002',
   '20260514-2000-0000-0000-000000000001', NULL, 'caregiver', NULL),
  -- membership for email_mismatch test
  ('20260514-2010-0000-0000-000000000003',
   '20260514-2000-0000-0000-000000000001', NULL, 'caregiver', NULL),
  -- membership for already_used test
  ('20260514-2010-0000-0000-000000000004',
   '20260514-2000-0000-0000-000000000001', NULL, 'caregiver', NULL),
  -- membership for email-normalization test
  ('20260514-2010-0000-0000-000000000005',
   '20260514-2000-0000-0000-000000000001', NULL, 'caregiver', NULL);

-- invite_tokens rows
INSERT INTO invite_tokens (id, token, membership_id, email, expires_at, consumed_at) VALUES
  -- Case 1 (happy path): valid, unconsumed, unexpired
  ('20260514-2020-0000-0000-000000000001',
   'oop001-valid-token',
   '20260514-2010-0000-0000-000000000001',
   'alice@oop001.test',
   now() + interval '48 hours',
   NULL),
  -- Case 3 (expired token): valid row but expires_at in the past
  ('20260514-2020-0000-0000-000000000002',
   'oop001-expired-token',
   '20260514-2010-0000-0000-000000000002',
   'alice@oop001.test',
   now() - interval '1 hour',
   NULL),
  -- Case 4 (email_mismatch): token email is different from caller's email
  ('20260514-2020-0000-0000-000000000003',
   'oop001-mismatch-token',
   '20260514-2010-0000-0000-000000000003',
   'carol@oop001.test',
   now() + interval '48 hours',
   NULL),
  -- Case 5 (already_used): token row already has consumed_at set
  ('20260514-2020-0000-0000-000000000004',
   'oop001-consumed-token',
   '20260514-2010-0000-0000-000000000004',
   'carol@oop001.test',
   now() + interval '48 hours',
   now() - interval '5 minutes'),
  -- Case 6 (email normalization): token email has leading/trailing spaces + uppercase
  ('20260514-2020-0000-0000-000000000005',
   'oop001-norm-token',
   '20260514-2010-0000-0000-000000000005',
   ' BOB@OOP001.TEST ',
   now() + interval '48 hours',
   NULL);

-- ============================================================
-- Case 1 — Happy path: valid unconsumed unexpired token + matching email
-- Call accept_invite once; capture both fields in a single CTE to avoid
-- a second call that would see the token as already_used.
-- ============================================================
SELECT results_eq(
  $$ SELECT (accept_invite('oop001-valid-token',
       '20260514-2001-0000-0000-000000000001'::uuid,
       'alice@oop001.test')).success $$,
  ARRAY[true],
  'case1: happy path returns success=true'
);

-- Verify side-effects: consumed_at populated
SELECT isnt(
  (SELECT consumed_at FROM invite_tokens WHERE token = 'oop001-valid-token'),
  NULL,
  'case1: consumed_at is set after successful accept'
);

-- Verify side-effects: membership activated
SELECT is(
  (SELECT user_id FROM memberships WHERE id = '20260514-2010-0000-0000-000000000001'),
  '20260514-2001-0000-0000-000000000001'::uuid,
  'case1: membership.user_id set to accepting user'
);

SELECT isnt(
  (SELECT accepted_at FROM memberships WHERE id = '20260514-2010-0000-0000-000000000001'),
  NULL,
  'case1: membership.accepted_at populated'
);

-- ============================================================
-- Case 2 — not_found: unknown token
-- ============================================================
SELECT results_eq(
  $$ SELECT (accept_invite('oop001-nonexistent-token',
       '20260514-2001-0000-0000-000000000001'::uuid,
       'alice@oop001.test')).error $$,
  ARRAY['not_found'],
  'case2: unknown token returns not_found'
);

-- ============================================================
-- Case 3 — not_found: valid token row but expired (expires_at < now())
-- The function SELECTs WHERE expires_at > now() so expired rows are invisible;
-- the result is identical to a missing token.
-- ============================================================
SELECT results_eq(
  $$ SELECT (accept_invite('oop001-expired-token',
       '20260514-2001-0000-0000-000000000001'::uuid,
       'alice@oop001.test')).error $$,
  ARRAY['not_found'],
  'case3: expired token returns not_found (expiry maps to not_found path)'
);

-- ============================================================
-- Case 4 — email_mismatch: valid unconsumed token, caller email differs
-- consumed_at must remain NULL; membership must remain untouched.
-- ============================================================
SELECT results_eq(
  $$ SELECT (accept_invite('oop001-mismatch-token',
       '20260514-2001-0000-0000-000000000001'::uuid,
       'alice@oop001.test')).error $$,
  ARRAY['email_mismatch'],
  'case4: wrong caller email returns email_mismatch'
);

SELECT is(
  (SELECT consumed_at FROM invite_tokens WHERE token = 'oop001-mismatch-token'),
  NULL::timestamptz,
  'case4: consumed_at stays NULL on email_mismatch (no side effects)'
);

-- ============================================================
-- Case 5 — already_used: token row with consumed_at IS NOT NULL
-- This exercises the UPDATE WHERE consumed_at IS NULL → ROW_COUNT=0 branch.
-- Note: genuine concurrent-accept races are not testable inside a single pgTAP
-- transaction (pg_background / two connections not available under supabase test db).
-- This test IS the contract test for that code branch — it exercises the exact
-- guard the concurrent-race handler relies on.
-- ============================================================
SELECT results_eq(
  $$ SELECT (accept_invite('oop001-consumed-token',
       '20260514-2003-0000-0000-000000000001'::uuid,
       'carol@oop001.test')).error $$,
  ARRAY['already_used'],
  'case5: pre-consumed token returns already_used (concurrent-accept contract)'
);

-- ============================================================
-- Case 6 — Email normalization: token email ' BOB@OOP001.TEST ' vs caller 'bob@oop001.test'
-- Function lowercases + trims both sides; the call must succeed.
-- ============================================================
SELECT results_eq(
  $$ SELECT (accept_invite('oop001-norm-token',
       '20260514-2002-0000-0000-000000000001'::uuid,
       'bob@oop001.test')).success $$,
  ARRAY[true],
  'case6: padded uppercase token email normalizes to match lowercased caller email'
);

SELECT * FROM finish();
ROLLBACK;
