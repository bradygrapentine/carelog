BEGIN;
SELECT plan(5);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('ee550005-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
   'coord@burnout-rls.com', now(), now(), now(), '{}', '{}', false),
  ('ff660006-0000-0000-0000-000000000006', 'authenticated', 'authenticated',
   'caregiver@burnout-rls.com', now(), now(), now(), '{}', '{}', false),
  ('77700007-0000-0000-0000-000000000007', 'authenticated', 'authenticated',
   'outsider@burnout-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('12000000-0000-0000-0000-000000000001', 'Burnout RLS Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
VALUES
  ('12000000-0000-0000-0000-000000000001', 'ee550005-0000-0000-0000-000000000005', 'coordinator', now(), null),
  ('12000000-0000-0000-0000-000000000001', 'ff660006-0000-0000-0000-000000000006', 'caregiver',   now(), null)
ON CONFLICT DO NOTHING;

-- Fixture: coordinator's existing check-in (inserted as postgres to bypass RLS)
INSERT INTO burnout_checkins (id, org_id, user_id, sleep_score, stress_score, support_score, week_stamp)
VALUES (
  '41000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000001',
  'ee550005-0000-0000-0000-000000000005',
  3, 4, 3, '2026-W10'
) ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Caregiver can INSERT their own check-in
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"ff660006-0000-0000-0000-000000000006","role":"authenticated"}';

SELECT lives_ok(
  $$INSERT INTO burnout_checkins (org_id, user_id, sleep_score, stress_score, support_score, week_stamp)
    VALUES (
      '12000000-0000-0000-0000-000000000001',
      'ff660006-0000-0000-0000-000000000006',
      4, 2, 5, '2026-W11'
    )$$,
  'caregiver can insert their own burnout check-in'
);

-- 2. Caregiver CANNOT INSERT with a different user_id (user_id must equal auth.uid())
SELECT throws_ok(
  $$INSERT INTO burnout_checkins (org_id, user_id, sleep_score, stress_score, support_score, week_stamp)
    VALUES (
      '12000000-0000-0000-0000-000000000001',
      'ee550005-0000-0000-0000-000000000005',
      3, 3, 3, '2026-W12'
    )$$,
  '42501', NULL,
  'caregiver cannot insert a check-in with another user''s user_id'
);

-- 3. Caregiver sees only their OWN rows (not the coordinator's row from fixtures)
SELECT results_eq(
  $$SELECT count(*)::int FROM burnout_checkins WHERE org_id = '12000000-0000-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'caregiver sees only their own check-ins, not other users'' rows'
);

-- 4. Coordinator can read ALL rows in their org
SET LOCAL "request.jwt.claims" TO '{"sub":"ee550005-0000-0000-0000-000000000005","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM burnout_checkins WHERE org_id = '12000000-0000-0000-0000-000000000001'$$,
  ARRAY[2]::int[],
  'coordinator can read all burnout_checkins for their org'
);

-- 5. Outsider (not a member) sees 0 rows
SET LOCAL "request.jwt.claims" TO '{"sub":"77700007-0000-0000-0000-000000000007","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM burnout_checkins WHERE org_id = '12000000-0000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'non-member cannot read burnout_checkins from another org'
);

SELECT * FROM finish();
ROLLBACK;
