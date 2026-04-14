BEGIN;
SELECT plan(9);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('d1000001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'author@mood-rls.com', now(), now(), now(), '{}', '{}', false),
  ('d2000002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'member@mood-rls.com', now(), now(), now(), '{}', '{}', false),
  ('d3000003-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'outsider@mood-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('d0100000-0000-0000-0000-000000000001', 'Mood RLS Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (org_id, full_name)
VALUES ('d0100000-0000-0000-0000-000000000001', 'Mood Test Recipient')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT 'd0200000-0000-0000-0000-000000000001', 'd0100000-0000-0000-0000-000000000001', token
FROM identity_vault WHERE org_id = 'd0100000-0000-0000-0000-000000000001' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
VALUES
  ('d0100000-0000-0000-0000-000000000001', 'd1000001-0000-0000-0000-000000000001', 'coordinator', now(), null),
  ('d0100000-0000-0000-0000-000000000001', 'd2000002-0000-0000-0000-000000000002', 'caregiver',   now(), 'd0200000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Fixture: mood entry authored by d1000001 — inserted as postgres to bypass RLS
INSERT INTO mood_entries (id, org_id, recipient_id, author_id, mood, note)
VALUES (
  'd0300000-0000-0000-0000-000000000001',
  'd0100000-0000-0000-0000-000000000001',
  'd0200000-0000-0000-0000-000000000001',
  'd1000001-0000-0000-0000-000000000001',
  'okay', 'Baseline fixture entry'
) ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Org member can read mood entries for an accessible recipient
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"d2000002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM mood_entries WHERE recipient_id = 'd0200000-0000-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'org member can read mood entries for an in-org recipient'
);

-- 2. Non-member (outsider) sees 0 rows for that recipient
SET LOCAL "request.jwt.claims" TO '{"sub":"d3000003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM mood_entries WHERE recipient_id = 'd0200000-0000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'non-member cannot read mood entries for a recipient in another org'
);

-- 3. Org member can INSERT a mood entry (as themselves)
SET LOCAL "request.jwt.claims" TO '{"sub":"d2000002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT lives_ok(
  $$INSERT INTO mood_entries (org_id, recipient_id, author_id, mood)
    VALUES (
      'd0100000-0000-0000-0000-000000000001',
      'd0200000-0000-0000-0000-000000000001',
      'd2000002-0000-0000-0000-000000000002',
      'good'
    )$$,
  'org member can insert a mood entry for an accessible recipient'
);

-- 4. Author can UPDATE their own mood entry
SET LOCAL "request.jwt.claims" TO '{"sub":"d1000001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$UPDATE mood_entries SET mood = 'difficult' WHERE id = 'd0300000-0000-0000-0000-000000000001'$$,
  'author can update their own mood entry'
);

-- 5. Non-author (other member) cannot UPDATE another author's entry
-- RLS silently skips — verify row is unchanged
SET LOCAL "request.jwt.claims" TO '{"sub":"d2000002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT lives_ok(
  $$UPDATE mood_entries SET mood = 'crisis' WHERE id = 'd0300000-0000-0000-0000-000000000001'$$,
  'non-author update silently skips (RLS blocks without error)'
);

SET LOCAL ROLE postgres;

SELECT results_eq(
  $$SELECT mood FROM mood_entries WHERE id = 'd0300000-0000-0000-0000-000000000001'$$,
  ARRAY['difficult']::text[],
  'mood entry unchanged after non-author update attempt'
);

-- 6. Non-author cannot DELETE another author's entry
-- RLS silently skips DELETE — verify row still present
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"d2000002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT lives_ok(
  $$DELETE FROM mood_entries WHERE id = 'd0300000-0000-0000-0000-000000000001'$$,
  'non-author delete silently skips (RLS blocks without error)'
);

SET LOCAL ROLE postgres;

SELECT results_eq(
  $$SELECT count(*)::int FROM mood_entries WHERE id = 'd0300000-0000-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'mood entry still present after non-author delete attempt'
);

-- 7 (final). Anon role sees zero rows
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '';

SELECT results_eq(
  $$SELECT count(*)::int FROM mood_entries$$,
  ARRAY[0]::int[],
  'anon sees zero mood_entries rows'
);

SELECT * FROM finish();
ROLLBACK;
