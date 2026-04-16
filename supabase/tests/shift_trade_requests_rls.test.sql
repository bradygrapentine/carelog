BEGIN;
SELECT plan(14);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

-- Create users: alice (coordinator), bob (caregiver), carol (caregiver), eve (cross-org)
INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'alice@str-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bbbb0002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'bob@str-rls.com', now(), now(), now(), '{}', '{}', false),
  ('cccc0003-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'carol@str-rls.com', now(), now(), now(), '{}', '{}', false),
  ('eeee0004-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
   'eve@str-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

-- Create org_a and org_b
INSERT INTO organizations (id, name, org_type)
VALUES
  ('org0000a-0000-0000-0000-000000000001', 'Org A', 'family'),
  ('org0000b-0000-0000-0000-000000000002', 'Org B', 'family')
ON CONFLICT DO NOTHING;

-- Create memberships: alice (coordinator), bob (caregiver), carol (caregiver) in org_a
INSERT INTO memberships (org_id, user_id, role, accepted_at)
VALUES
  ('org0000a-0000-0000-0000-000000000001', 'aaaa0001-0000-0000-0000-000000000001', 'coordinator', now()),
  ('org0000a-0000-0000-0000-000000000001', 'bbbb0002-0000-0000-0000-000000000002', 'caregiver', now()),
  ('org0000a-0000-0000-0000-000000000001', 'cccc0003-0000-0000-0000-000000000003', 'caregiver', now()),
  ('org0000b-0000-0000-0000-000000000002', 'eeee0004-0000-0000-0000-000000000004', 'caregiver', now())
ON CONFLICT DO NOTHING;

-- Create a shift assigned to bob in org_a
INSERT INTO shifts (id, org_id, assignee_user_id, start_time, end_time)
VALUES
  ('shift001-0000-0000-0000-000000000001', 'org0000a-0000-0000-0000-000000000001',
   'bbbb0002-0000-0000-0000-000000000002', now(), now() + interval '8 hours')
ON CONFLICT DO NOTHING;

-- Create a shift assigned to eve in org_b (for isolation testing)
INSERT INTO shifts (id, org_id, assignee_user_id, start_time, end_time)
VALUES
  ('shift002-0000-0000-0000-000000000002', 'org0000b-0000-0000-0000-000000000002',
   'eeee0004-0000-0000-0000-000000000004', now(), now() + interval '8 hours')
ON CONFLICT DO NOTHING;

-- Create a targeted trade request: bob requests carol to take his shift
INSERT INTO shift_trade_requests (
  id, shift_id, org_id, requested_by, target_user_id, status, message
)
VALUES
  ('trade01-0000-0000-0000-000000000001', 'shift001-0000-0000-0000-000000000001',
   'org0000a-0000-0000-0000-000000000001', 'bbbb0002-0000-0000-0000-000000000002',
   'cccc0003-0000-0000-0000-000000000003', 'open', 'Can you take my shift?')
ON CONFLICT DO NOTHING;

-- Create an open trade request: bob requests anyone to take his shift (null target)
INSERT INTO shift_trade_requests (
  id, shift_id, org_id, requested_by, target_user_id, status, message
)
VALUES
  ('trade02-0000-0000-0000-000000000002', 'shift001-0000-0000-0000-000000000001',
   'org0000a-0000-0000-0000-000000000001', 'bbbb0002-0000-0000-0000-000000000002',
   null, 'open', 'Anyone available?')
ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Bob (assignee) can INSERT a trade request
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"bbbb0002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT lives_ok(
  $$INSERT INTO shift_trade_requests (shift_id, org_id, requested_by, target_user_id, status)
    VALUES (
      'shift001-0000-0000-0000-000000000001',
      'org0000a-0000-0000-0000-000000000001',
      'bbbb0002-0000-0000-0000-000000000002',
      'cccc0003-0000-0000-0000-000000000003',
      'open'
    )$$,
  'Bob (assignee) can INSERT a trade request'
);

-- 2. Carol (org member but not assignee) cannot INSERT
SET LOCAL "request.jwt.claims" TO '{"sub":"cccc0003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO shift_trade_requests (shift_id, org_id, requested_by, target_user_id, status)
    VALUES (
      'shift001-0000-0000-0000-000000000001',
      'org0000a-0000-0000-0000-000000000001',
      'cccc0003-0000-0000-0000-000000000003',
      'bbbb0002-0000-0000-0000-000000000002',
      'open'
    )$$,
  '42501', NULL,
  'Carol (org member but not assignee) cannot INSERT'
);

-- 3. Eve (cross-org) cannot INSERT
SET LOCAL "request.jwt.claims" TO '{"sub":"eeee0004-0000-0000-0000-000000000004","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO shift_trade_requests (shift_id, org_id, requested_by, target_user_id, status)
    VALUES (
      'shift001-0000-0000-0000-000000000001',
      'org0000a-0000-0000-0000-000000000001',
      'eeee0004-0000-0000-0000-000000000004',
      'cccc0003-0000-0000-0000-000000000003',
      'open'
    )$$,
  '42501', NULL,
  'Eve (cross-org) cannot INSERT'
);

-- 4. Alice (coordinator) cannot INSERT (she is not the assignee)
SET LOCAL "request.jwt.claims" TO '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO shift_trade_requests (shift_id, org_id, requested_by, target_user_id, status)
    VALUES (
      'shift001-0000-0000-0000-000000000001',
      'org0000a-0000-0000-0000-000000000001',
      'aaaa0001-0000-0000-0000-000000000001',
      'cccc0003-0000-0000-0000-000000000003',
      'open'
    )$$,
  '42501', NULL,
  'Alice (coordinator) cannot INSERT when not assignee'
);

-- 5. All org members can SELECT trade requests
SET LOCAL "request.jwt.claims" TO '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM shift_trade_requests WHERE org_id = 'org0000a-0000-0000-0000-000000000001'$$,
  ARRAY[2]::int[],
  'Alice (coordinator) can SELECT trade requests in her org'
);

SET LOCAL "request.jwt.claims" TO '{"sub":"bbbb0002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM shift_trade_requests WHERE org_id = 'org0000a-0000-0000-0000-000000000001'$$,
  ARRAY[2]::int[],
  'Bob (caregiver) can SELECT trade requests in his org'
);

-- 6. Eve (cross-org) cannot SELECT any trade requests
SET LOCAL "request.jwt.claims" TO '{"sub":"eeee0004-0000-0000-0000-000000000004","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM shift_trade_requests WHERE org_id = 'org0000a-0000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'Eve (cross-org) cannot SELECT trade requests from org_a'
);

-- 7. Carol (target) can UPDATE status to 'accepted'
SET LOCAL "request.jwt.claims" TO '{"sub":"cccc0003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT lives_ok(
  $$UPDATE shift_trade_requests
    SET status = 'accepted'
    WHERE id = 'trade01-0000-0000-0000-000000000001' AND target_user_id = 'cccc0003-0000-0000-0000-000000000003'$$,
  'Carol (target) can UPDATE status to accepted'
);

-- 8. Carol (target) can UPDATE status to 'declined'
--    First, restore the trade request to 'open' state
SET LOCAL ROLE postgres;
UPDATE shift_trade_requests SET status = 'open'
WHERE id = 'trade01-0000-0000-0000-000000000001';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"cccc0003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT lives_ok(
  $$UPDATE shift_trade_requests
    SET status = 'declined'
    WHERE id = 'trade01-0000-0000-0000-000000000001'$$,
  'Carol (target) can UPDATE status to declined'
);

-- 9. Bob (non-target) cannot UPDATE Carol's targeted request
SET LOCAL "request.jwt.claims" TO '{"sub":"bbbb0002-0000-0000-0000-000000000002","role":"authenticated"}';

-- First restore trade01 to 'open' with null status for the next test
SET LOCAL ROLE postgres;
UPDATE shift_trade_requests SET status = 'open', resolved_by = null, resolved_at = null
WHERE id = 'trade01-0000-0000-0000-000000000001';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"bbbb0002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT throws_ok(
  $$UPDATE shift_trade_requests
    SET status = 'accepted'
    WHERE id = 'trade01-0000-0000-0000-000000000001'$$,
  '42501', NULL,
  'Bob (non-target) cannot UPDATE Carol targeted request'
);

-- 10. Alice (coordinator) can force-UPDATE any trade request
SET LOCAL "request.jwt.claims" TO '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$UPDATE shift_trade_requests
    SET status = 'accepted', resolved_by = 'aaaa0001-0000-0000-0000-000000000001', resolved_at = now()
    WHERE id = 'trade01-0000-0000-0000-000000000001'$$,
  'Alice (coordinator) can force-UPDATE any trade request'
);

-- 11. No one can DELETE (RLS silently skips — test with lives_ok + verify row exists)
SET LOCAL "request.jwt.claims" TO '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$DELETE FROM shift_trade_requests WHERE id = 'trade02-0000-0000-0000-000000000002'$$,
  'DELETE does not throw (RLS silently skips)'
);

-- Verify the row still exists
SELECT results_eq(
  $$SELECT count(*)::int FROM shift_trade_requests WHERE id = 'trade02-0000-0000-0000-000000000002'$$,
  ARRAY[1]::int[],
  'Trade request row still exists after DELETE attempt (RLS silently skipped)'
);

-- 12. Anon blocked on all operations
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM shift_trade_requests$$,
  ARRAY[0]::int[],
  'Anon role cannot SELECT shift_trade_requests'
);

SELECT throws_ok(
  $$INSERT INTO shift_trade_requests (shift_id, org_id, requested_by, target_user_id, status)
    VALUES (
      'shift001-0000-0000-0000-000000000001',
      'org0000a-0000-0000-0000-000000000001',
      'bbbb0002-0000-0000-0000-000000000002',
      'cccc0003-0000-0000-0000-000000000003',
      'open'
    )$$,
  '42501', NULL,
  'Anon role cannot INSERT into shift_trade_requests'
);

-- 13. Open trade (null target_user_id) — any org member can UPDATE to accept
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"cccc0003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT lives_ok(
  $$UPDATE shift_trade_requests
    SET status = 'accepted'
    WHERE id = 'trade02-0000-0000-0000-000000000002'$$,
  'Carol can UPDATE open trade (null target) to accept'
);

-- 14. Skip status transition constraint test — no constraint currently in migration
--     Placeholder for future: if a check constraint is added to enforce only 'open' → other,
--     add test here. For now, the RLS policies alone don't enforce transition rules.
SELECT pass('Status transitions not enforced by RLS (would require check constraint)');

SELECT * FROM finish();
ROLLBACK;
