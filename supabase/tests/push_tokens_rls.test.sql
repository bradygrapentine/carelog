BEGIN;
SELECT plan(5);

-- Seed two auth users (owner A, intruder B)
INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated',
   'ownera@push-test.com', now(), now(), now(), '{}', '{}', false),
  ('bbbbbbbb-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated',
   'intruderb@push-test.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

-- 1. Owner A can INSERT their own token
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1"}';

WITH inserted AS (
  INSERT INTO push_tokens (auth_user_id, token, platform)
  VALUES ('aaaaaaaa-0000-0000-0000-0000000000a1', 'token-a-1', 'ios')
  RETURNING 1
)
SELECT is(
  (SELECT count(*)::int FROM inserted),
  1,
  'owner can insert their own push token'
);

-- 2. Owner A can SELECT their own token
SELECT is(
  (SELECT count(*)::int FROM push_tokens WHERE auth_user_id = 'aaaaaaaa-0000-0000-0000-0000000000a1'),
  1,
  'owner can select their own push tokens'
);

-- 3. Intruder B cannot SELECT owner A's token
SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b2"}';
SELECT is(
  (SELECT count(*)::int FROM push_tokens WHERE auth_user_id = 'aaaaaaaa-0000-0000-0000-0000000000a1'),
  0,
  'intruder cannot see another user''s push tokens'
);

-- 4. Intruder B cannot INSERT a token with owner A's auth_user_id
SELECT throws_ok(
  $$ INSERT INTO push_tokens (auth_user_id, token, platform)
     VALUES ('aaaaaaaa-0000-0000-0000-0000000000a1', 'stolen-token', 'ios') $$,
  '42501',
  NULL,
  'intruder cannot insert token for another user'
);

-- 5. Anon role sees zero rows
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
SELECT is(
  (SELECT count(*)::int FROM push_tokens),
  0,
  'anon sees zero push tokens'
);

SELECT * FROM finish();
ROLLBACK;
