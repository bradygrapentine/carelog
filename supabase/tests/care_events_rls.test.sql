-- supabase/tests/care_events_rls.test.sql
-- TD-24: RLS coverage for care_events (the most-written PHI table).
--
-- Policies under test (from core_schema migration):
--   SELECT — user_can_access_recipient(recipient_id)
--   INSERT — user_can_access_recipient(recipient_id) AND actor_id = auth.uid()
--   UPDATE — user_is_coordinator_for(recipient_id)
--   DELETE — no policy (RLS silently skips deletes; not exercised here)
--
-- Critical scenarios verified:
--   1. Cross-org isolation (Org B member reads/writes Org A → blocked)
--   2. Aide recipient-scoping (membership.recipient_id = R1 cannot access R2 in same org)
--   3. INSERT actor_id forgery (cannot insert with another user's actor_id)
--   4. Caregiver cannot UPDATE (coordinator-only)

begin;
select plan(15);

-- ─── Fixtures ──────────────────────────────────────────────────────────────

set local role postgres;

-- Users: alice (coord A, org-wide), bob (caregiver A, org-wide),
--        carla (aide A, scoped to R1 only), eve (coord B)
insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('aaaa0024-4400-0000-0000-000000000001', 'authenticated', 'authenticated',
   'alice@td24-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bbbb0024-4400-0000-0000-000000000002', 'authenticated', 'authenticated',
   'bob@td24-rls.com', now(), now(), now(), '{}', '{}', false),
  ('cccc0024-4400-0000-0000-000000000003', 'authenticated', 'authenticated',
   'carla@td24-rls.com', now(), now(), now(), '{}', '{}', false),
  ('eeee0024-4400-0000-0000-000000000004', 'authenticated', 'authenticated',
   'eve@td24-rls.com', now(), now(), now(), '{}', '{}', false)
on conflict (id) do nothing;

-- Orgs
insert into organizations (id, name, org_type) values
  ('aaaa0024-4400-0000-0000-000000000010', 'Org A TD24', 'family'),
  ('eeee0024-4400-0000-0000-000000000020', 'Org B TD24', 'family')
on conflict do nothing;

-- Recipients: R1 + R2 in Org A, R3 in Org B (via identity_vault pattern;
-- identity_vault PK is `token`, not `id`)
insert into identity_vault (token, org_id, full_name) values
  ('aaaa0024-4400-1111-0000-000000000001', 'aaaa0024-4400-0000-0000-000000000010', 'TD24 Recipient R1'),
  ('aaaa0024-4400-2222-0000-000000000002', 'aaaa0024-4400-0000-0000-000000000010', 'TD24 Recipient R2'),
  ('eeee0024-4400-3333-0000-000000000003', 'eeee0024-4400-0000-0000-000000000020', 'TD24 Recipient R3')
on conflict do nothing;

insert into care_recipients (id, org_id, identity_token) values
  ('11ec0024-4400-0000-0000-000000000031', 'aaaa0024-4400-0000-0000-000000000010', 'aaaa0024-4400-1111-0000-000000000001'),
  ('22ec0024-4400-0000-0000-000000000032', 'aaaa0024-4400-0000-0000-000000000010', 'aaaa0024-4400-2222-0000-000000000002'),
  ('33ec0024-4400-0000-0000-000000000033', 'eeee0024-4400-0000-0000-000000000020', 'eeee0024-4400-3333-0000-000000000003')
on conflict do nothing;

-- Memberships:
--   alice  → Org A coordinator (recipient_id NULL → org-wide)
--   bob    → Org A caregiver   (recipient_id NULL → org-wide)
--   carla  → Org A aide        (recipient_id = R1 → scoped to R1 only)
--   eve    → Org B coordinator (recipient_id NULL → org-wide)
insert into memberships (org_id, user_id, role, recipient_id, accepted_at) values
  ('aaaa0024-4400-0000-0000-000000000010', 'aaaa0024-4400-0000-0000-000000000001', 'coordinator', NULL, now()),
  ('aaaa0024-4400-0000-0000-000000000010', 'bbbb0024-4400-0000-0000-000000000002', 'caregiver',   NULL, now()),
  ('aaaa0024-4400-0000-0000-000000000010', 'cccc0024-4400-0000-0000-000000000003', 'aide',
   '11ec0024-4400-0000-0000-000000000031', now()),
  ('eeee0024-4400-0000-0000-000000000020', 'eeee0024-4400-0000-0000-000000000004', 'coordinator', NULL, now())
on conflict do nothing;

-- Pre-seed care events for SELECT/UPDATE tests:
--   E1: R1 in Org A by alice; E2: R2 in Org A by alice; E3: R3 in Org B by eve
insert into care_events (id, org_id, recipient_id, actor_id, event_type, entry_kind, occurred_at) values
  ('e1ec0024-4400-0000-0000-000000000041',
   'aaaa0024-4400-0000-0000-000000000010',
   '11ec0024-4400-0000-0000-000000000031',
   'aaaa0024-4400-0000-0000-000000000001',
   'journal', 'human', now()),
  ('e2ec0024-4400-0000-0000-000000000042',
   'aaaa0024-4400-0000-0000-000000000010',
   '22ec0024-4400-0000-0000-000000000032',
   'aaaa0024-4400-0000-0000-000000000001',
   'journal', 'human', now()),
  ('e3ec0024-4400-0000-0000-000000000043',
   'eeee0024-4400-0000-0000-000000000020',
   '33ec0024-4400-0000-0000-000000000033',
   'eeee0024-4400-0000-0000-000000000004',
   'journal', 'human', now())
on conflict do nothing;

-- ─── SELECT tests ──────────────────────────────────────────────────────────

set local role authenticated;

-- 1. alice (org-wide coord) SELECT R1 events
set local "request.jwt.claims" to '{"sub":"aaaa0024-4400-0000-0000-000000000001","role":"authenticated"}';
select ok(
  (select count(*) from care_events where recipient_id = '11ec0024-4400-0000-0000-000000000031') >= 1,
  'alice (org-wide coord) can SELECT R1 events'
);

-- 2. alice (org-wide coord) SELECT R2 events
select ok(
  (select count(*) from care_events where recipient_id = '22ec0024-4400-0000-0000-000000000032') >= 1,
  'alice (org-wide coord) can SELECT R2 events in same org'
);

-- 3. carla (aide, scoped to R1) SELECT R1 → allowed
set local "request.jwt.claims" to '{"sub":"cccc0024-4400-0000-0000-000000000003","role":"authenticated"}';
select ok(
  (select count(*) from care_events where recipient_id = '11ec0024-4400-0000-0000-000000000031') >= 1,
  'carla (aide scoped to R1) can SELECT R1 events'
);

-- 4. CRITICAL: carla (aide, scoped to R1) SELECT R2 → blocked even though same org
select ok(
  (select count(*) from care_events where recipient_id = '22ec0024-4400-0000-0000-000000000032') = 0,
  'carla (aide scoped to R1) CANNOT SELECT R2 events (aide scoping enforced)'
);

-- 5. eve (Org B) SELECT R1 (Org A) → blocked
set local "request.jwt.claims" to '{"sub":"eeee0024-4400-0000-0000-000000000004","role":"authenticated"}';
select ok(
  (select count(*) from care_events where recipient_id = '11ec0024-4400-0000-0000-000000000031') = 0,
  'eve (org_b coord) CANNOT SELECT org_a R1 events (cross-org isolation)'
);

-- 6. alice (Org A) SELECT R3 (Org B) → blocked
set local "request.jwt.claims" to '{"sub":"aaaa0024-4400-0000-0000-000000000001","role":"authenticated"}';
select ok(
  (select count(*) from care_events where recipient_id = '33ec0024-4400-0000-0000-000000000033') = 0,
  'alice (org_a coord) CANNOT SELECT org_b R3 events (cross-org isolation)'
);

-- ─── INSERT tests ──────────────────────────────────────────────────────────

-- 7. alice INSERT into R1 with actor_id = alice → succeeds
select lives_ok(
  $$
    insert into care_events (org_id, recipient_id, actor_id, event_type, entry_kind, occurred_at)
    values (
      'aaaa0024-4400-0000-0000-000000000010',
      '11ec0024-4400-0000-0000-000000000031',
      'aaaa0024-4400-0000-0000-000000000001',
      'journal', 'human', now()
    )
  $$,
  'alice can INSERT a care_event into R1 with herself as actor'
);

-- 8. alice INSERT into R1 with actor_id = bob → blocked (actor_id forgery)
select throws_ok(
  $$
    insert into care_events (org_id, recipient_id, actor_id, event_type, entry_kind, occurred_at)
    values (
      'aaaa0024-4400-0000-0000-000000000010',
      '11ec0024-4400-0000-0000-000000000031',
      'bbbb0024-4400-0000-0000-000000000002',
      'journal', 'human', now()
    )
  $$,
  '42501',
  NULL,
  'alice CANNOT INSERT a care_event with bob as actor_id (forgery blocked)'
);

-- 9. eve (Org B) INSERT into R1 (Org A) → blocked
set local "request.jwt.claims" to '{"sub":"eeee0024-4400-0000-0000-000000000004","role":"authenticated"}';
select throws_ok(
  $$
    insert into care_events (org_id, recipient_id, actor_id, event_type, entry_kind, occurred_at)
    values (
      'aaaa0024-4400-0000-0000-000000000010',
      '11ec0024-4400-0000-0000-000000000031',
      'eeee0024-4400-0000-0000-000000000004',
      'journal', 'human', now()
    )
  $$,
  '42501',
  NULL,
  'eve (org_b) CANNOT INSERT a care_event into org_a R1 (cross-org blocked)'
);

-- 10. carla (aide R1) INSERT into R1 → succeeds (within scope)
set local "request.jwt.claims" to '{"sub":"cccc0024-4400-0000-0000-000000000003","role":"authenticated"}';
select lives_ok(
  $$
    insert into care_events (org_id, recipient_id, actor_id, event_type, entry_kind, occurred_at)
    values (
      'aaaa0024-4400-0000-0000-000000000010',
      '11ec0024-4400-0000-0000-000000000031',
      'cccc0024-4400-0000-0000-000000000003',
      'journal', 'human', now()
    )
  $$,
  'carla (aide scoped to R1) can INSERT a care_event into R1'
);

-- 11. CRITICAL: carla (aide R1) INSERT into R2 → blocked (out-of-scope)
select throws_ok(
  $$
    insert into care_events (org_id, recipient_id, actor_id, event_type, entry_kind, occurred_at)
    values (
      'aaaa0024-4400-0000-0000-000000000010',
      '22ec0024-4400-0000-0000-000000000032',
      'cccc0024-4400-0000-0000-000000000003',
      'journal', 'human', now()
    )
  $$,
  '42501',
  NULL,
  'carla (aide scoped to R1) CANNOT INSERT into R2 (aide scoping enforced on writes)'
);

-- ─── UPDATE tests ──────────────────────────────────────────────────────────

-- 12. alice (coordinator) UPDATE E1 → succeeds
set local "request.jwt.claims" to '{"sub":"aaaa0024-4400-0000-0000-000000000001","role":"authenticated"}';
update care_events set flagged = true where id = 'e1ec0024-4400-0000-0000-000000000041';
select ok(
  (select flagged from care_events where id = 'e1ec0024-4400-0000-0000-000000000041') = true,
  'alice (coordinator) can UPDATE care_event in same org'
);

-- (E1 is now flagged=true after test 12. Tests 13-15 try to flip back to
-- false; if RLS silently skips, flagged stays true.)

-- 13. bob (caregiver, NOT coord) UPDATE E1 → silently skipped (RLS)
set local "request.jwt.claims" to '{"sub":"bbbb0024-4400-0000-0000-000000000002","role":"authenticated"}';
update care_events set flagged = false where id = 'e1ec0024-4400-0000-0000-000000000041';
select ok(
  (select flagged from care_events where id = 'e1ec0024-4400-0000-0000-000000000041') = true,
  'bob (caregiver, not coordinator) UPDATE silently skipped — flagged still true'
);

-- 14. carla (aide, NOT coord) UPDATE E1 → silently skipped (RLS)
set local "request.jwt.claims" to '{"sub":"cccc0024-4400-0000-0000-000000000003","role":"authenticated"}';
update care_events set flagged = false where id = 'e1ec0024-4400-0000-0000-000000000041';
select ok(
  (select flagged from care_events where id = 'e1ec0024-4400-0000-0000-000000000041') = true,
  'carla (aide, not coordinator) UPDATE silently skipped — flagged still true'
);

-- 15. eve (Org B coord) UPDATE Org A E1 → silently skipped (cross-org).
-- Switch back to alice's claims before the assertion — eve cannot SELECT
-- the Org A row at all, so the assertion would read NULL under her context.
set local "request.jwt.claims" to '{"sub":"eeee0024-4400-0000-0000-000000000004","role":"authenticated"}';
update care_events set flagged = false where id = 'e1ec0024-4400-0000-0000-000000000041';
set local "request.jwt.claims" to '{"sub":"aaaa0024-4400-0000-0000-000000000001","role":"authenticated"}';
select ok(
  (select flagged from care_events where id = 'e1ec0024-4400-0000-0000-000000000041') = true,
  'eve (org_b coord) UPDATE on org_a E1 silently skipped — flagged still true'
);

-- ─── End ───────────────────────────────────────────────────────────────────

select * from finish();
rollback;
