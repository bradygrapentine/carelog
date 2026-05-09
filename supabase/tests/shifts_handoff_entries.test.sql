BEGIN;
SELECT plan(9);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aaaa1101-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@handoff.com', now(), now(), now(), '{}', '{}', false),
  ('bbbb1101-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'caregiver@handoff.com', now(), now(), now(), '{}', '{}', false),
  ('cccc1101-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'outsider@handoff.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('11010000-0000-0000-0000-000000000001', 'Handoff Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (org_id, full_name)
VALUES ('11010000-0000-0000-0000-000000000001', 'Handoff Recipient')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT '21010000-0000-0000-0000-000000000001',
       '11010000-0000-0000-0000-000000000001',
       token
FROM identity_vault WHERE org_id = '11010000-0000-0000-0000-000000000001' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
VALUES
  ('11010000-0000-0000-0000-000000000001',
   'aaaa1101-0000-0000-0000-000000000001',
   'coordinator', now(), null),
  ('11010000-0000-0000-0000-000000000001',
   'bbbb1101-0000-0000-0000-000000000002',
   'caregiver', now(), '21010000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Column exists with the expected type.
SELECT col_type_is(
  'public', 'shifts', 'handoff_entries', 'jsonb',
  'shifts.handoff_entries should be jsonb'
);

-- 2. Column is NOT NULL.
SELECT col_not_null(
  'public', 'shifts', 'handoff_entries',
  'shifts.handoff_entries should be NOT NULL'
);

-- 3. Default value is the empty JSONB array (read from pg_attrdef directly —
--    pgTAP col_default_is has fragile quoting around jsonb literals).
SELECT is(
  (SELECT pg_get_expr(d.adbin, d.adrelid)
     FROM pg_attrdef d
     JOIN pg_attribute a
       ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE d.adrelid = 'public.shifts'::regclass
      AND a.attname = 'handoff_entries'),
  $$'[]'::jsonb$$,
  'shifts.handoff_entries should default to []::jsonb'
);

-- 4. Backfill safety — inserting a new row without specifying
--    handoff_entries lands an empty array.
INSERT INTO shifts (id, org_id, recipient_id, assignee_user_id,
                    start_at, end_at, status, created_by)
VALUES (
  '31010000-0000-0000-0000-000000000001',
  '11010000-0000-0000-0000-000000000001',
  '21010000-0000-0000-0000-000000000001',
  'bbbb1101-0000-0000-0000-000000000002',
  now() + interval '2 days',
  now() + interval '2 days' + interval '8 hours',
  'scheduled',
  'aaaa1101-0000-0000-0000-000000000001'
);

SELECT is(
  (SELECT handoff_entries FROM shifts
   WHERE id = '31010000-0000-0000-0000-000000000001'),
  '[]'::jsonb,
  'newly inserted row should default handoff_entries to []::jsonb'
);

-- 5. CHECK constraint rejects non-array JSON (object literal).
SELECT throws_ok(
  $$ UPDATE shifts
       SET handoff_entries = '{"kind":"sleep","text":"slept poorly"}'::jsonb
     WHERE id = '31010000-0000-0000-0000-000000000001' $$,
  '23514',
  NULL,
  'CHECK constraint should reject non-array JSON object'
);

-- 6. CHECK constraint accepts a populated JSON array.
UPDATE shifts
   SET handoff_entries = '[{"kind":"sleep","text":"slept 6h, 2 wakes"},
                          {"kind":"meds","text":"all on time"}]'::jsonb
 WHERE id = '31010000-0000-0000-0000-000000000001';

SELECT is(
  jsonb_array_length(
    (SELECT handoff_entries FROM shifts
     WHERE id = '31010000-0000-0000-0000-000000000001')
  ),
  2,
  'CHECK constraint should accept a 2-element JSON array'
);

-- 7. RLS on shifts unchanged — outsider cannot SELECT this row.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"cccc1101-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT is_empty(
  $$ SELECT id FROM shifts
     WHERE id = '31010000-0000-0000-0000-000000000001' $$,
  'RLS still blocks outsider SELECT after handoff_entries column add'
);

-- 8. Positive-path RLS — coordinator CAN SELECT the row.
SET LOCAL "request.jwt.claims" = '{"sub":"aaaa1101-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT isnt_empty(
  $$ SELECT id FROM shifts
     WHERE id = '31010000-0000-0000-0000-000000000001' $$,
  'coordinator can SELECT the shift after handoff_entries column add'
);

-- 9. Outsider UPDATE to handoff_entries is silently no-op (RLS row-blocked).
SET LOCAL "request.jwt.claims" = '{"sub":"cccc1101-0000-0000-0000-000000000003","role":"authenticated"}';

UPDATE shifts
   SET handoff_entries = '[{"kind":"injected","text":"outsider edit"}]'::jsonb
 WHERE id = '31010000-0000-0000-0000-000000000001';

SET LOCAL ROLE postgres;

SELECT is(
  jsonb_array_length(
    (SELECT handoff_entries FROM shifts
     WHERE id = '31010000-0000-0000-0000-000000000001')
  ),
  2,
  'outsider UPDATE was RLS-blocked — handoff_entries unchanged at 2 entries'
);

SELECT * FROM finish();
ROLLBACK;
