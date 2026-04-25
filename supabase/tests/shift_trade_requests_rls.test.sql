BEGIN;
SELECT plan(17);

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
  ('a0000000-0000-0000-0000-000000000001', 'Org A', 'family'),
  ('b0000000-0000-0000-0000-000000000002', 'Org B', 'family')
ON CONFLICT DO NOTHING;

-- Create memberships: alice (coordinator), bob (caregiver), carol (caregiver) in org_a
INSERT INTO memberships (org_id, user_id, role, accepted_at)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'aaaa0001-0000-0000-0000-000000000001', 'coordinator', now()),
  ('a0000000-0000-0000-0000-000000000001', 'bbbb0002-0000-0000-0000-000000000002', 'caregiver', now()),
  ('a0000000-0000-0000-0000-000000000001', 'cccc0003-0000-0000-0000-000000000003', 'caregiver', now()),
  ('b0000000-0000-0000-0000-000000000002', 'eeee0004-0000-0000-0000-000000000004', 'caregiver', now())
ON CONFLICT DO NOTHING;

-- Create a care recipient in org_a (required for shifts)
INSERT INTO identity_vault (org_id, full_name)
VALUES ('a0000000-0000-0000-0000-000000000001', 'STR Test Recipient')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT 'fa000001-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', token
FROM identity_vault WHERE org_id = 'a0000000-0000-0000-0000-000000000001' LIMIT 1
ON CONFLICT DO NOTHING;

-- Create a shift assigned to bob in org_a
INSERT INTO shifts (id, org_id, recipient_id, assignee_user_id, start_at, end_at, created_by)
VALUES
  ('ca000001-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'fa000001-0000-0000-0000-000000000001',
   'bbbb0002-0000-0000-0000-000000000002',
   now(), now() + interval '8 hours',
   'aaaa0001-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Create a targeted trade request: bob requests carol to take his shift
INSERT INTO shift_trade_requests (
  id, shift_id, org_id, requested_by, target_user_id, status, message
)
VALUES
  ('db000001-0000-0000-0000-000000000001', 'ca000001-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001', 'bbbb0002-0000-0000-0000-000000000002',
   'cccc0003-0000-0000-0000-000000000003', 'open', 'Can you take my shift?')
ON CONFLICT DO NOTHING;

-- Create an open trade request: bob requests anyone to take his shift (null target)
INSERT INTO shift_trade_requests (
  id, shift_id, org_id, requested_by, target_user_id, status, message
)
VALUES
  ('db000002-0000-0000-0000-000000000002', 'ca000001-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001', 'bbbb0002-0000-0000-0000-000000000002',
   null, 'open', 'Anyone available?')
ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Bob (assignee) can INSERT a trade request
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"bbbb0002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT lives_ok(
  $$INSERT INTO shift_trade_requests (shift_id, org_id, requested_by, target_user_id, status)
    VALUES (
      'ca000001-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000001',
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
      'ca000001-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000001',
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
      'ca000001-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000001',
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
      'ca000001-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000001',
      'aaaa0001-0000-0000-0000-000000000001',
      'cccc0003-0000-0000-0000-000000000003',
      'open'
    )$$,
  '42501', NULL,
  'Alice (coordinator) cannot INSERT when not assignee'
);

-- 5. All org members can SELECT trade requests
--    Note: test 1 added a 3rd row, so count is now 3
SET LOCAL "request.jwt.claims" TO '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM shift_trade_requests WHERE org_id = 'a0000000-0000-0000-0000-000000000001'$$,
  ARRAY[3]::int[],
  'Alice (coordinator) can SELECT trade requests in her org'
);

SET LOCAL "request.jwt.claims" TO '{"sub":"bbbb0002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM shift_trade_requests WHERE org_id = 'a0000000-0000-0000-0000-000000000001'$$,
  ARRAY[3]::int[],
  'Bob (caregiver) can SELECT trade requests in his org'
);

-- 6. Eve (cross-org) cannot SELECT any trade requests
SET LOCAL "request.jwt.claims" TO '{"sub":"eeee0004-0000-0000-0000-000000000004","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM shift_trade_requests WHERE org_id = 'a0000000-0000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'Eve (cross-org) cannot SELECT trade requests from org_a'
);

-- 7. Carol (target) can UPDATE status to 'accepted'
SET LOCAL "request.jwt.claims" TO '{"sub":"cccc0003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT lives_ok(
  $$UPDATE shift_trade_requests
    SET status = 'accepted'
    WHERE id = 'db000001-0000-0000-0000-000000000001' AND target_user_id = 'cccc0003-0000-0000-0000-000000000003'$$,
  'Carol (target) can UPDATE status to accepted'
);

-- 8. Carol (target) can UPDATE status to 'declined'
--    First, restore the trade request to 'open' state
SET LOCAL ROLE postgres;
UPDATE shift_trade_requests SET status = 'open'
WHERE id = 'db000001-0000-0000-0000-000000000001';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"cccc0003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT lives_ok(
  $$UPDATE shift_trade_requests
    SET status = 'declined'
    WHERE id = 'db000001-0000-0000-0000-000000000001'$$,
  'Carol (target) can UPDATE status to declined'
);

-- 9. Bob (non-target) cannot UPDATE Carol's targeted request
--    RLS USING clause silently skips rows where predicate fails (no throw for UPDATE)
--    Restore db000001 to 'open' first
SET LOCAL ROLE postgres;
UPDATE shift_trade_requests SET status = 'open', resolved_by = null, resolved_at = null
WHERE id = 'db000001-0000-0000-0000-000000000001';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"bbbb0002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT lives_ok(
  $$UPDATE shift_trade_requests
    SET status = 'accepted'
    WHERE id = 'db000001-0000-0000-0000-000000000001'$$,
  'Bob (non-target) UPDATE does not throw (RLS silently skips)'
);

-- Verify bob's UPDATE did not change status (silently skipped 0 rows)
SET LOCAL ROLE postgres;
SELECT results_eq(
  $$SELECT status FROM shift_trade_requests WHERE id = 'db000001-0000-0000-0000-000000000001'$$,
  ARRAY['open'::text],
  'Bob (non-target) UPDATE silently skipped — status still open'
);

-- 10. Alice (coordinator) can force-UPDATE any trade request
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$UPDATE shift_trade_requests
    SET status = 'accepted', resolved_by = 'aaaa0001-0000-0000-0000-000000000001', resolved_at = now()
    WHERE id = 'db000001-0000-0000-0000-000000000001'$$,
  'Alice (coordinator) can force-UPDATE any trade request'
);

-- 11. No one can DELETE (no DELETE policy — RLS silently skips)
SELECT lives_ok(
  $$DELETE FROM shift_trade_requests WHERE id = 'db000002-0000-0000-0000-000000000002'$$,
  'DELETE does not throw (RLS silently skips)'
);

-- Verify the row still exists
SELECT results_eq(
  $$SELECT count(*)::int FROM shift_trade_requests WHERE id = 'db000002-0000-0000-0000-000000000002'$$,
  ARRAY[1]::int[],
  'Trade request row still exists after DELETE attempt (RLS silently skipped)'
);

-- 12. Anon blocked on SELECT (sees 0 rows)
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM shift_trade_requests$$,
  ARRAY[0]::int[],
  'Anon role cannot SELECT shift_trade_requests'
);

-- 13. Anon blocked on INSERT (throws 42501)
SELECT throws_ok(
  $$INSERT INTO shift_trade_requests (shift_id, org_id, requested_by, target_user_id, status)
    VALUES (
      'ca000001-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000001',
      'bbbb0002-0000-0000-0000-000000000002',
      'cccc0003-0000-0000-0000-000000000003',
      'open'
    )$$,
  '42501', NULL,
  'Anon role cannot INSERT into shift_trade_requests'
);

-- 14. Open trade (null target_user_id) — any org member can UPDATE to accept
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"cccc0003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT lives_ok(
  $$UPDATE shift_trade_requests
    SET status = 'accepted'
    WHERE id = 'db000002-0000-0000-0000-000000000002'$$,
  'Carol can UPDATE open trade (null target) to accept'
);

SELECT * FROM finish();
ROLLBACK;
