BEGIN;
SELECT plan(3);

-- Setup: org, two users (inviter + invitee), one pending membership
INSERT INTO organizations (id, name, org_type) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Test Org', 'family');

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated',
  'inviter@example.com', now(), now(), now(), '{}', '{}', false
), (
  '00000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated',
  'invitee@example.com', now(), now(), now(), '{}', '{}', false
);

INSERT INTO memberships (id, org_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-000000000020',
   '00000000-0000-0000-0000-000000000001',
   NULL, 'caregiver');

-- Test 1: invited_by_user_id column exists on invite_tokens
SELECT has_column(
  'public', 'invite_tokens', 'invited_by_user_id',
  'invite_tokens has invited_by_user_id column'
);

-- Test 2: insert with invited_by_user_id succeeds
INSERT INTO invite_tokens (
  token, membership_id, email, expires_at, invited_by_user_id
) VALUES (
  'with-inviter-token',
  '00000000-0000-0000-0000-000000000020',
  'invitee@example.com',
  now() + interval '48 hours',
  '00000000-0000-0000-0000-000000000010'
);

SELECT results_eq(
  $$ SELECT invited_by_user_id FROM invite_tokens WHERE token = 'with-inviter-token' $$,
  ARRAY['00000000-0000-0000-0000-000000000010'::uuid],
  'invite_tokens row stores the inviter user_id'
);

-- Test 3: invited_by_user_id is nullable (legacy rows)
INSERT INTO invite_tokens (
  token, membership_id, email, expires_at, invited_by_user_id
) VALUES (
  'no-inviter-token',
  '00000000-0000-0000-0000-000000000020',
  'invitee@example.com',
  now() + interval '48 hours',
  NULL
);

SELECT results_eq(
  $$ SELECT invited_by_user_id FROM invite_tokens WHERE token = 'no-inviter-token' $$,
  ARRAY[NULL]::uuid[],
  'invited_by_user_id accepts NULL for legacy / unattributed rows'
);

SELECT * FROM finish();
ROLLBACK;
