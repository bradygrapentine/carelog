BEGIN;
SELECT plan(15);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aaaa1102-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@questions.com', now(), now(), now(), '{}', '{}', false),
  ('bbbb1102-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'caregiver@questions.com', now(), now(), now(), '{}', '{}', false),
  ('cccc1102-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'outsider@questions.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('11020000-0000-0000-0000-000000000001', 'Questions Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (org_id, full_name)
VALUES ('11020000-0000-0000-0000-000000000001', 'Questions Recipient')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT '21020000-0000-0000-0000-000000000001',
       '11020000-0000-0000-0000-000000000001',
       token
FROM identity_vault WHERE org_id = '11020000-0000-0000-0000-000000000001' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
VALUES
  ('11020000-0000-0000-0000-000000000001',
   'aaaa1102-0000-0000-0000-000000000001',
   'coordinator', now(), null),
  ('11020000-0000-0000-0000-000000000001',
   'bbbb1102-0000-0000-0000-000000000002',
   'caregiver', now(), '21020000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Seed: one open question raised by the caregiver.
INSERT INTO shift_questions (id, org_id, recipient_id, body, raised_by)
VALUES (
  '31020000-0000-0000-0000-000000000001',
  '11020000-0000-0000-0000-000000000001',
  '21020000-0000-0000-0000-000000000001',
  'Did Mom take her morning Aricept?',
  'bbbb1102-0000-0000-0000-000000000002'
);

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Resolve atomicity CHECK rejects half-resolved row (resolved_at without resolved_by).
SELECT throws_ok(
  $$ INSERT INTO shift_questions
       (id, org_id, recipient_id, body, raised_by, resolved_at)
     VALUES (
       '31020000-0000-0000-0000-000000000099',
       '11020000-0000-0000-0000-000000000001',
       '21020000-0000-0000-0000-000000000001',
       'half-resolved',
       'bbbb1102-0000-0000-0000-000000000002',
       now()
     ) $$,
  '23514',
  NULL,
  'CHECK rejects resolved_at without resolved_by'
);

-- 2. Resolve atomicity CHECK rejects resolved_by without resolved_at.
SELECT throws_ok(
  $$ INSERT INTO shift_questions
       (id, org_id, recipient_id, body, raised_by, resolved_by)
     VALUES (
       '31020000-0000-0000-0000-000000000098',
       '11020000-0000-0000-0000-000000000001',
       '21020000-0000-0000-0000-000000000001',
       'half-resolved-2',
       'bbbb1102-0000-0000-0000-000000000002',
       'aaaa1102-0000-0000-0000-000000000001'
     ) $$,
  '23514',
  NULL,
  'CHECK rejects resolved_by without resolved_at'
);

-- 3. Length CHECK rejects empty text.
SELECT throws_ok(
  $$ INSERT INTO shift_questions (org_id, recipient_id, body, raised_by)
     VALUES (
       '11020000-0000-0000-0000-000000000001',
       '21020000-0000-0000-0000-000000000001',
       '',
       'bbbb1102-0000-0000-0000-000000000002'
     ) $$,
  '23514',
  NULL,
  'CHECK rejects empty text'
);

-- 4. Length CHECK rejects 2001-char text.
SELECT throws_ok(
  format(
    $$INSERT INTO shift_questions (org_id, recipient_id, body, raised_by)
      VALUES (%L, %L, %L, %L)$$,
    '11020000-0000-0000-0000-000000000001',
    '21020000-0000-0000-0000-000000000001',
    repeat('x', 2001),
    'bbbb1102-0000-0000-0000-000000000002'
  ),
  '23514',
  NULL,
  'CHECK rejects text longer than 2000 chars'
);

-- 5. RLS — outsider cannot SELECT.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub":"cccc1102-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT is_empty(
  $$ SELECT id FROM shift_questions
     WHERE id = '31020000-0000-0000-0000-000000000001' $$,
  'outsider cannot SELECT shift_questions'
);

-- 6. RLS — outsider INSERT is blocked (WITH CHECK fires).
SELECT throws_ok(
  $$ INSERT INTO shift_questions (org_id, recipient_id, body, raised_by)
     VALUES (
       '11020000-0000-0000-0000-000000000001',
       '21020000-0000-0000-0000-000000000001',
       'outsider injection',
       'cccc1102-0000-0000-0000-000000000003'
     ) $$,
  '42501',
  NULL,
  'outsider INSERT blocked by RLS'
);

-- 7. RLS — caregiver (team member) CAN SELECT.
SET LOCAL "request.jwt.claims" =
  '{"sub":"bbbb1102-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT isnt_empty(
  $$ SELECT id FROM shift_questions
     WHERE id = '31020000-0000-0000-0000-000000000001' $$,
  'caregiver can SELECT their team''s questions'
);

-- 8. RLS — caregiver CAN INSERT a new question.
INSERT INTO shift_questions (id, org_id, recipient_id, body, raised_by)
VALUES (
  '31020000-0000-0000-0000-000000000002',
  '11020000-0000-0000-0000-000000000001',
  '21020000-0000-0000-0000-000000000001',
  'Did dinner go OK?',
  'bbbb1102-0000-0000-0000-000000000002'
);

SET LOCAL ROLE postgres;

SELECT is(
  (SELECT count(*)::int FROM shift_questions
     WHERE id = '31020000-0000-0000-0000-000000000002'),
  1,
  'caregiver INSERT landed'
);

-- 9. RLS — coordinator can resolve a caregiver-raised question.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub":"aaaa1102-0000-0000-0000-000000000001","role":"authenticated"}';

UPDATE shift_questions
   SET resolved_at = now(),
       resolved_by = 'aaaa1102-0000-0000-0000-000000000001'
 WHERE id = '31020000-0000-0000-0000-000000000001';

SET LOCAL ROLE postgres;

SELECT is(
  (SELECT resolved_by FROM shift_questions
     WHERE id = '31020000-0000-0000-0000-000000000001'),
  'aaaa1102-0000-0000-0000-000000000001'::uuid,
  'coordinator resolve UPDATE landed; resolved_by recorded'
);

-- 10. RLS — outsider UPDATE is silently no-op (row-blocked).
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub":"cccc1102-0000-0000-0000-000000000003","role":"authenticated"}';

UPDATE shift_questions
   SET body = 'outsider tampering'
 WHERE id = '31020000-0000-0000-0000-000000000002';

SET LOCAL ROLE postgres;

SELECT is(
  (SELECT body FROM shift_questions
     WHERE id = '31020000-0000-0000-0000-000000000002'),
  'Did dinner go OK?',
  'outsider UPDATE was RLS-blocked — text unchanged'
);

-- 11. Partial index covers open-question lookups (excludes resolved rows).
SELECT has_index(
  'public', 'shift_questions', 'shift_questions_recipient_open_idx',
  'partial index on (recipient_id, raised_at DESC) WHERE resolved_at IS NULL exists'
);

-- 12. Caregiver cannot spoof raised_by — INSERT with someone else's user_id is RLS-blocked.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub":"bbbb1102-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT throws_ok(
  $$ INSERT INTO shift_questions (org_id, recipient_id, body, raised_by)
     VALUES (
       '11020000-0000-0000-0000-000000000001',
       '21020000-0000-0000-0000-000000000001',
       'spoofed by caregiver',
       'aaaa1102-0000-0000-0000-000000000001'
     ) $$,
  '42501',
  NULL,
  'INSERT with raised_by != auth.uid() is RLS-blocked (no spoofing)'
);

-- 13. Cross-org INSERT — caregiver cannot insert with recipient_id from a different org.
-- Set up a second org + recipient that the caregiver is NOT a member of.
SET LOCAL ROLE postgres;

INSERT INTO organizations (id, name, org_type)
VALUES ('11020000-0000-0000-0000-000000000099', 'Other Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (org_id, full_name)
VALUES ('11020000-0000-0000-0000-000000000099', 'Other Recipient')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT '21020000-0000-0000-0000-000000000099',
       '11020000-0000-0000-0000-000000000099',
       token
FROM identity_vault
WHERE org_id = '11020000-0000-0000-0000-000000000099' LIMIT 1
ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub":"bbbb1102-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT throws_ok(
  $$ INSERT INTO shift_questions (org_id, recipient_id, body, raised_by)
     VALUES (
       '11020000-0000-0000-0000-000000000001',
       '21020000-0000-0000-0000-000000000099',
       'cross-org leak attempt',
       'bbbb1102-0000-0000-0000-000000000002'
     ) $$,
  '42501',
  NULL,
  'INSERT with recipient_id from a different org is RLS-blocked (no PHI leak)'
);

-- 14. Immutability trigger — UPDATE attempting to change org_id raises.
SET LOCAL ROLE postgres;

SELECT throws_ok(
  $$ UPDATE shift_questions
       SET org_id = '11020000-0000-0000-0000-000000000099'
     WHERE id = '31020000-0000-0000-0000-000000000002' $$,
  'P0001',
  'shift_questions.org_id is immutable',
  'trigger forbids mutating org_id on UPDATE'
);

-- 15. Immutability trigger — UPDATE attempting to change raised_by raises.
SELECT throws_ok(
  $$ UPDATE shift_questions
       SET raised_by = 'aaaa1102-0000-0000-0000-000000000001'
     WHERE id = '31020000-0000-0000-0000-000000000002' $$,
  'P0001',
  'shift_questions.raised_by is immutable',
  'trigger forbids mutating raised_by on UPDATE'
);

SELECT * FROM finish();
ROLLBACK;
