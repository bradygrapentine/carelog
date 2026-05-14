-- supabase/tests/journal_reactions_rls.test.sql
-- OOP-002: pgTAP coverage for journal_reactions INSERT/UPDATE/DELETE/SELECT policies.
--
-- Fixture-UUID prefix: 20260514-1xxx-... (Track 1 prefix; Track 2 uses 20260514-2xxx-...)
-- This ensures no UUID collision when both test files run under one `supabase test db`.

begin;
select plan(9);

-- ─── Fixtures ──────────────────────────────────────────────────────────────

set local role postgres;

-- Users: alice + bob in org_a (accepted), eve in org_b (accepted)
insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('20260514-1001-0000-0000-000000000001', 'authenticated', 'authenticated',
   'alice@jr-rls.com', now(), now(), now(), '{}', '{}', false),
  ('20260514-1002-0000-0000-000000000002', 'authenticated', 'authenticated',
   'bob@jr-rls.com',   now(), now(), now(), '{}', '{}', false),
  ('20260514-1003-0000-0000-000000000003', 'authenticated', 'authenticated',
   'eve@jr-rls.com',   now(), now(), now(), '{}', '{}', false)
on conflict (id) do nothing;

-- Orgs
insert into organizations (id, name, org_type) values
  ('20260514-1010-0000-0000-000000000010', 'Org A JR', 'family'),
  ('20260514-1020-0000-0000-000000000020', 'Org B JR', 'family')
on conflict do nothing;

-- Memberships
insert into memberships (org_id, user_id, role, accepted_at) values
  ('20260514-1010-0000-0000-000000000010', '20260514-1001-0000-0000-000000000001', 'coordinator', now()),
  ('20260514-1010-0000-0000-000000000010', '20260514-1002-0000-0000-000000000002', 'caregiver',   now()),
  ('20260514-1020-0000-0000-000000000020', '20260514-1003-0000-0000-000000000003', 'caregiver',   now())
on conflict do nothing;

-- Care recipient in org_a
insert into identity_vault (org_id, full_name) values
  ('20260514-1010-0000-0000-000000000010', 'JR RLS Test Recipient')
on conflict do nothing;

insert into care_recipients (id, org_id, identity_token)
select '20260514-1030-0000-0000-000000000030', '20260514-1010-0000-0000-000000000010', token
from identity_vault
where org_id = '20260514-1010-0000-0000-000000000010'
limit 1
on conflict do nothing;

-- Care event in org_a, authored by alice
insert into care_events (id, org_id, recipient_id, actor_id, event_type, entry_kind, occurred_at) values
  ('20260514-1040-0000-0000-000000000040',
   '20260514-1010-0000-0000-000000000010',
   '20260514-1030-0000-0000-000000000030',
   '20260514-1001-0000-0000-000000000001',
   'journal', 'human', now())
on conflict do nothing;

-- Pre-seed alice's reaction for update/delete tests (inserted as postgres to bypass RLS)
insert into journal_reactions (event_id, user_id, reaction) values
  ('20260514-1040-0000-0000-000000000040',
   '20260514-1001-0000-0000-000000000001',
   'heart')
on conflict (event_id, user_id) do nothing;

-- ─── Tests ─────────────────────────────────────────────────────────────────

-- 1. Team member (bob) can INSERT a reaction on an accessible care_event
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"20260514-1002-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$
    insert into journal_reactions (event_id, user_id, reaction)
    values (
      '20260514-1040-0000-0000-000000000040',
      '20260514-1002-0000-0000-000000000002',
      'strong'
    )
    on conflict (event_id, user_id) do nothing
  $$,
  '1. org_a member (bob) can INSERT a reaction on an accessible care_event'
);

-- 2. Non-member (eve) CANNOT INSERT a reaction — the security gap this migration fixes.
--    Before OOP-002, only user_id = auth.uid() was checked; eve could react on org_a events.
set local "request.jwt.claims" to '{"sub":"20260514-1003-0000-0000-000000000003","role":"authenticated"}';

select throws_ok(
  $$
    insert into journal_reactions (event_id, user_id, reaction)
    values (
      '20260514-1040-0000-0000-000000000040',
      '20260514-1003-0000-0000-000000000003',
      'heart'
    )
  $$,
  '42501',
  NULL,
  '2. non-member (eve) CANNOT INSERT a reaction on an event outside their org'
);

-- 3. Owner (alice) can UPDATE their reaction
set local "request.jwt.claims" to '{"sub":"20260514-1001-0000-0000-000000000001","role":"authenticated"}';

update journal_reactions
  set reaction = 'grateful'
  where event_id = '20260514-1040-0000-0000-000000000040'
    and user_id   = '20260514-1001-0000-0000-000000000001';

select ok(
  (select reaction from journal_reactions
    where event_id = '20260514-1040-0000-0000-000000000040'
      and user_id  = '20260514-1001-0000-0000-000000000001') = 'grateful',
  '3. owner (alice) can UPDATE their reaction'
);

-- 4. Non-owner (bob) CANNOT UPDATE alice's reaction (RLS silently skips — row unchanged)
set local "request.jwt.claims" to '{"sub":"20260514-1002-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$
    update journal_reactions
      set reaction = 'thinking_of_you'
      where event_id = '20260514-1040-0000-0000-000000000040'
        and user_id  = '20260514-1001-0000-0000-000000000001'
  $$,
  '4a. bob UPDATE attempt on alice''s reaction does not throw (RLS silently skips)'
);

set local role postgres;
select ok(
  (select reaction from journal_reactions
    where event_id = '20260514-1040-0000-0000-000000000040'
      and user_id  = '20260514-1001-0000-0000-000000000001') = 'grateful',
  '4b. alice''s reaction is unchanged after bob''s UPDATE attempt'
);

-- 5. Owner (alice) can DELETE their own reaction (regression guard — existing policy)
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"20260514-1001-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$
    delete from journal_reactions
      where event_id = '20260514-1040-0000-0000-000000000040'
        and user_id  = '20260514-1001-0000-0000-000000000001'
  $$,
  '5a. owner (alice) can DELETE their own reaction'
);

set local role postgres;
select ok(
  (select count(*) from journal_reactions
    where event_id = '20260514-1040-0000-0000-000000000040'
      and user_id  = '20260514-1001-0000-0000-000000000001') = 0,
  '5b. reaction is gone after alice DELETE'
);

-- 6. Team member (bob) can SELECT all reactions on accessible events (regression guard)
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"20260514-1002-0000-0000-000000000002","role":"authenticated"}';

-- bob's own reaction still exists from test 1; confirm SELECT returns it
select ok(
  (select count(*) from journal_reactions
    where event_id = '20260514-1040-0000-0000-000000000040') >= 1,
  '6. team member (bob) can SELECT reactions on accessible events'
);

select finish();
rollback;
