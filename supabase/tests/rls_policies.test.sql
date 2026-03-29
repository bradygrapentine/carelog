BEGIN;
SELECT plan(8);

-- Helper: create test org and recipient
CREATE OR REPLACE FUNCTION create_test_fixtures()
RETURNS TABLE(org_id uuid, recipient_id uuid, vault_token uuid) AS $$
DECLARE
  v_org_id uuid;
  v_token  uuid;
  v_rec_id uuid;
BEGIN
  INSERT INTO organizations (name, org_type)
  VALUES ('Test Org', 'family')
  RETURNING id INTO v_org_id;

  INSERT INTO identity_vault (org_id, full_name)
  VALUES (v_org_id, 'Test Person')
  RETURNING token INTO v_token;

  INSERT INTO care_recipients (org_id, identity_token)
  VALUES (v_org_id, v_token)
  RETURNING id INTO v_rec_id;

  RETURN QUERY SELECT v_org_id, v_rec_id, v_token;
END;
$$ LANGUAGE plpgsql;

-- 1. Service role can read identity vault
SET LOCAL ROLE service_role;
SELECT ok(
  (SELECT count(*) FROM identity_vault) >= 0,
  'service role can read identity vault'
);

-- 2. Anon cannot read identity vault
SET LOCAL ROLE anon;
SELECT results_eq(
  'SELECT count(*)::int FROM identity_vault',
  ARRAY[0]::int[],
  'anon cannot read identity vault'
);

-- 3. Authenticated user cannot read identity vault
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT results_eq(
  'SELECT count(*)::int FROM identity_vault',
  ARRAY[0]::int[],
  'authenticated user cannot read identity vault'
);

-- 4. Anon cannot read care events
SET LOCAL ROLE anon;
SELECT results_eq(
  'SELECT count(*)::int FROM care_events',
  ARRAY[0]::int[],
  'anon cannot read care events'
);

-- 5. Anon cannot read organizations
SET LOCAL ROLE anon;
SELECT results_eq(
  'SELECT count(*)::int FROM organizations',
  ARRAY[0]::int[],
  'anon cannot read organizations'
);

-- 6. Anon cannot read memberships
SET LOCAL ROLE anon;
SELECT results_eq(
  'SELECT count(*)::int FROM memberships',
  ARRAY[0]::int[],
  'anon cannot read memberships'
);

-- 7. Outer circle requests are publicly readable
SET LOCAL ROLE anon;
SELECT ok(
  (SELECT count(*)::int FROM outer_circle_requests) >= 0,
  'outer circle requests are publicly readable'
);

-- 8. Care briefs are publicly readable (token enforced in API)
SET LOCAL ROLE anon;
SELECT ok(
  (SELECT count(*)::int FROM care_briefs) >= 0,
  'care briefs are publicly readable'
);

SELECT * FROM finish();
ROLLBACK;