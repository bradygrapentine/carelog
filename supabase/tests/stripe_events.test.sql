-- SEC-002: stripe_events deduplication pgTAP tests.
--
-- Test plan (3 assertions):
--   1. First insert of event_id='evt_test_1' succeeds.
--   2. Second insert of the same event_id raises unique_violation (23505).
--   3. SELECT returns exactly one row (first insert persisted).
BEGIN;
SELECT plan(3);

SET LOCAL ROLE service_role;

-- 1. First insert succeeds.
SELECT lives_ok(
  $$INSERT INTO stripe_events (event_id, event_type)
    VALUES ('evt_test_1', 'customer.subscription.updated')$$,
  'service_role: first insert of evt_test_1 succeeds'
);

-- 2. Duplicate insert raises unique_violation.
SELECT throws_ok(
  $$INSERT INTO stripe_events (event_id, event_type)
    VALUES ('evt_test_1', 'customer.subscription.updated')$$,
  '23505', NULL,
  'service_role: duplicate event_id raises unique_violation'
);

-- 3. Only one row persisted.
SELECT is(
  (SELECT count(*)::int FROM stripe_events WHERE event_id = 'evt_test_1'),
  1,
  'exactly one row for evt_test_1'
);

SELECT * FROM finish();
ROLLBACK;
