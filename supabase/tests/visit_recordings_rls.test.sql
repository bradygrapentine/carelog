BEGIN;
SELECT plan(5);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aa330001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'alice@vr-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bb330002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'bob@vr-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('cc330000-0000-0000-0000-000000000001', 'VR Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at)
VALUES ('cc330000-0000-0000-0000-000000000001', 'aa330001-0000-0000-0000-000000000001', 'coordinator', now())
ON CONFLICT DO NOTHING;

-- Identity vault entry for the test recipient (real names live here, not
-- on care_recipients itself).
INSERT INTO identity_vault (token, org_id, full_name)
VALUES ('11335577-0000-0000-0000-000000000001',
        'cc330000-0000-0000-0000-000000000001',
        'Eleanor VR')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
VALUES ('dd330000-0000-0000-0000-000000000001',
        'cc330000-0000-0000-0000-000000000001',
        '11335577-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Seed a recording owned by Alice's org (insert as postgres, RLS off here).
INSERT INTO visit_recordings (
  id, org_id, recipient_id, audio_url, status, created_by
) VALUES (
  'ee330000-0000-0000-0000-000000000001',
  'cc330000-0000-0000-0000-000000000001',
  'dd330000-0000-0000-0000-000000000001',
  'https://storage.test/audio/alice-1.m4a',
  'pending',
  'aa330001-0000-0000-0000-000000000001'
)
ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Alice (member of the org) can read recordings for her recipient.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa330001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM visit_recordings
    WHERE recipient_id = 'dd330000-0000-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'alice reads her org''s recording'
);

-- 2. Bob (not a member of the org) cannot read.
SET LOCAL "request.jwt.claims" TO '{"sub":"bb330002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT is_empty(
  $$SELECT * FROM visit_recordings$$,
  'bob (no membership) cannot read alice''s recordings'
);

-- 3. Anon role blocked.
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';

SELECT is_empty(
  $$SELECT * FROM visit_recordings$$,
  'anon blocked from visit_recordings'
);

-- 4. Bob cannot insert for a recipient he can't access.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"bb330002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO visit_recordings (org_id, recipient_id, audio_url, created_by)
    VALUES ('cc330000-0000-0000-0000-000000000001',
            'dd330000-0000-0000-0000-000000000001',
            'https://storage.test/audio/evil.m4a',
            'bb330002-0000-0000-0000-000000000002')$$,
  '42501',
  NULL,
  'bob cannot insert into alice''s org'
);

-- 5. event_type enum carries the visit_note value (insert smoke test).
SET LOCAL ROLE postgres;
INSERT INTO care_events (
  id, org_id, recipient_id, actor_id, event_type, entry_kind, payload, occurred_at
) VALUES (
  'ff330000-0000-0000-0000-000000000099',
  'cc330000-0000-0000-0000-000000000001',
  'dd330000-0000-0000-0000-000000000001',
  'aa330001-0000-0000-0000-000000000001',
  'visit_note',
  'system',
  '{}'::jsonb,
  now()
)
ON CONFLICT DO NOTHING;

SELECT results_eq(
  $$SELECT event_type::text FROM care_events WHERE id = 'ff330000-0000-0000-0000-000000000099'$$,
  ARRAY['visit_note']::text[],
  'event_type accepts visit_note'
);

SELECT * FROM finish();
ROLLBACK;
