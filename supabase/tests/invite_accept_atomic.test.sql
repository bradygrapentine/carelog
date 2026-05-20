BEGIN;
SELECT plan(9);

-- Setup: org, user profile, membership, invite token
INSERT INTO organizations (id, name, org_type) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Test Org', 'family');

-- Must insert into auth.users first to satisfy user_profiles FK
INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
  'alice@example.com', now(), now(), now(), '{}', '{}', false
);

-- user_profiles row is auto-created by handle_new_user trigger on auth.users insert

INSERT INTO memberships (id, org_id, user_id, role, recipient_id) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   NULL, 'caregiver', NULL);

INSERT INTO invite_tokens (id, token, membership_id, email, expires_at) VALUES
  ('00000000-0000-0000-0000-000000000020', 'test-token-abc',
   '00000000-0000-0000-0000-000000000010',
   'alice@example.com',
   now() + interval '48 hours');

-- Test 1: valid accept returns success
SELECT results_eq(
  $$ SELECT (accept_invite('test-token-abc', '00000000-0000-0000-0000-000000000002'::uuid, 'alice@example.com')).success $$,
  ARRAY[true],
  'valid accept returns success=true'
);

-- Test 2: token is marked consumed
SELECT isnt(
  (SELECT consumed_at FROM invite_tokens WHERE token = 'test-token-abc'),
  NULL,
  'consumed_at is set after accept'
);

-- Test 3: membership is activated with correct user_id
SELECT is(
  (SELECT user_id FROM memberships WHERE id = '00000000-0000-0000-0000-000000000010'),
  '00000000-0000-0000-0000-000000000002'::uuid,
  'membership user_id is set to accepting user'
);

-- Test 4: second call on consumed token returns error
SELECT results_eq(
  $$ SELECT (accept_invite('test-token-abc', '00000000-0000-0000-0000-000000000002'::uuid, 'alice@example.com')).error $$,
  ARRAY['already_used'],
  'second accept returns already_used error'
);

-- Test 5: wrong email returns error
-- Fresh pending membership so test is realistic
INSERT INTO memberships (id, org_id, user_id, role, recipient_id) VALUES
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001',
   NULL, 'caregiver', NULL);

INSERT INTO invite_tokens (id, token, membership_id, email, expires_at) VALUES
  ('00000000-0000-0000-0000-000000000021', 'test-token-xyz',
   '00000000-0000-0000-0000-000000000011',
   'bob@example.com',
   now() + interval '48 hours');

SELECT results_eq(
  $$ SELECT (accept_invite('test-token-xyz', '00000000-0000-0000-0000-000000000002'::uuid, 'alice@example.com')).error $$,
  ARRAY['email_mismatch'],
  'wrong email returns email_mismatch error'
);

-- Test 6 (TD-208): membership row missing at activation time → fail closed with
-- membership_not_found, NOT a phantom success=true. The invite_tokens →
-- memberships FK is ON DELETE CASCADE (and re-checked on the token-consume
-- UPDATE), so we drop the FK for this transaction to leave a token whose
-- activation UPDATE matches 0 rows. ROLLBACK restores the constraint.
ALTER TABLE invite_tokens DROP CONSTRAINT invite_tokens_membership_id_fkey;

INSERT INTO memberships (id, org_id, user_id, role, recipient_id) VALUES
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001',
   NULL, 'caregiver', NULL);

INSERT INTO invite_tokens (id, token, membership_id, email, expires_at) VALUES
  ('00000000-0000-0000-0000-000000000022', 'test-token-orphan',
   '00000000-0000-0000-0000-000000000012',
   'carol@example.com',
   now() + interval '48 hours');

DELETE FROM memberships WHERE id = '00000000-0000-0000-0000-000000000012';

SELECT results_eq(
  $$ SELECT (accept_invite('test-token-orphan', '00000000-0000-0000-0000-000000000002'::uuid, 'carol@example.com')).error $$,
  ARRAY['membership_not_found'],
  'missing membership row returns membership_not_found (no phantom success)'
);

-- Test 7 (TD-208 / TD-217 regression guard): CREATE OR REPLACE must keep the
-- pinned search_path (CVE-2018-1058 hardening).
SELECT is(
  (SELECT proconfig FROM pg_proc
   WHERE oid = 'accept_invite(text, uuid, text)'::regprocedure),
  ARRAY['search_path=public, pg_temp'],
  'accept_invite retains SET search_path = public, pg_temp'
);

-- Tests 8-9 (TD-129 lockdown guard): CREATE OR REPLACE re-grants default EXECUTE
-- to anon/authenticated; the migration's REVOKEs must hold.
SELECT is(
  has_function_privilege('anon', 'accept_invite(text, uuid, text)', 'EXECUTE'),
  false,
  'anon cannot EXECUTE accept_invite'
);
SELECT is(
  has_function_privilege('authenticated', 'accept_invite(text, uuid, text)', 'EXECUTE'),
  false,
  'authenticated cannot EXECUTE accept_invite'
);

SELECT * FROM finish();
ROLLBACK;
