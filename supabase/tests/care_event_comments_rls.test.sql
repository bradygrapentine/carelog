-- supabase/tests/care_event_comments_rls.test.sql
-- ON-44: RLS coverage for care_event_comments
begin;
select plan(15);

-- ─── Fixtures ──────────────────────────────────────────────────────────────

set local role postgres;

-- Users: alice + bob in org_a, eve in org_b
insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('aaaa0001-4400-0000-0000-000000000001', 'authenticated', 'authenticated',
   'alice@cec-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bbbb0002-4400-0000-0000-000000000002', 'authenticated', 'authenticated',
   'bob@cec-rls.com', now(), now(), now(), '{}', '{}', false),
  ('eeee0003-4400-0000-0000-000000000003', 'authenticated', 'authenticated',
   'eve@cec-rls.com', now(), now(), now(), '{}', '{}', false)
on conflict (id) do nothing;

-- Orgs
insert into organizations (id, name, org_type) values
  ('aaaa0010-4400-0000-0000-000000000010', 'Org A CEC', 'family'),
  ('eeee0020-4400-0000-0000-000000000020', 'Org B CEC', 'family')
on conflict do nothing;

-- Memberships: alice + bob → org_a; eve → org_b
insert into memberships (org_id, user_id, role, accepted_at) values
  ('aaaa0010-4400-0000-0000-000000000010', 'aaaa0001-4400-0000-0000-000000000001', 'coordinator', now()),
  ('aaaa0010-4400-0000-0000-000000000010', 'bbbb0002-4400-0000-0000-000000000002', 'caregiver',   now()),
  ('eeee0020-4400-0000-0000-000000000020', 'eeee0003-4400-0000-0000-000000000003', 'caregiver',   now())
on conflict do nothing;

-- Care recipient in org_a (via identity_vault pattern)
insert into identity_vault (org_id, full_name) values
  ('aaaa0010-4400-0000-0000-000000000010', 'CEC Test Recipient')
on conflict do nothing;

insert into care_recipients (id, org_id, identity_token)
select 'cccc0030-4400-0000-0000-000000000030', 'aaaa0010-4400-0000-0000-000000000010', token
from identity_vault where org_id = 'aaaa0010-4400-0000-0000-000000000010' limit 1
on conflict do nothing;

-- Care event in org_a, authored by alice
insert into care_events (id, org_id, recipient_id, actor_id, event_type, entry_kind, occurred_at) values
  ('dddd0040-4400-0000-0000-000000000040',
   'aaaa0010-4400-0000-0000-000000000010',
   'cccc0030-4400-0000-0000-000000000030',
   'aaaa0001-4400-0000-0000-000000000001',
   'journal', 'human', now())
on conflict do nothing;

-- Alice's comment (for update/delete tests)
insert into care_event_comments (id, care_event_id, org_id, author_id, body) values
  ('ffff0050-4400-0000-0000-000000000050',
   'dddd0040-4400-0000-0000-000000000040',
   'aaaa0010-4400-0000-0000-000000000010',
   'aaaa0001-4400-0000-0000-000000000001',
   'Alice initial comment')
on conflict do nothing;

-- ─── Tests ─────────────────────────────────────────────────────────────────

-- 1. alice (org A member) can INSERT a comment
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaa0001-4400-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$
    insert into care_event_comments (care_event_id, org_id, author_id, body)
    values (
      'dddd0040-4400-0000-0000-000000000040',
      'aaaa0010-4400-0000-0000-000000000010',
      'aaaa0001-4400-0000-0000-000000000001',
      'Alice comment'
    )
  $$,
  'alice (org_a member) can INSERT a comment'
);

-- 2. bob (org A member) can INSERT a comment
set local "request.jwt.claims" to '{"sub":"bbbb0002-4400-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$
    insert into care_event_comments (care_event_id, org_id, author_id, body)
    values (
      'dddd0040-4400-0000-0000-000000000040',
      'aaaa0010-4400-0000-0000-000000000010',
      'bbbb0002-4400-0000-0000-000000000002',
      'Bob comment'
    )
  $$,
  'bob (org_a member) can INSERT a comment'
);

-- 3. eve (org B member) cannot INSERT → 42501
set local "request.jwt.claims" to '{"sub":"eeee0003-4400-0000-0000-000000000003","role":"authenticated"}';

select throws_ok(
  $$
    insert into care_event_comments (care_event_id, org_id, author_id, body)
    values (
      'dddd0040-4400-0000-0000-000000000040',
      'aaaa0010-4400-0000-0000-000000000010',
      'eeee0003-4400-0000-0000-000000000003',
      'Eve cross-org comment'
    )
  $$,
  '42501',
  NULL,
  'eve (org_b member) cannot INSERT into org_a comment'
);

-- 4. alice can SELECT comments on the event (count ≥ 1)
set local "request.jwt.claims" to '{"sub":"aaaa0001-4400-0000-0000-000000000001","role":"authenticated"}';

select ok(
  (select count(*) from care_event_comments
    where care_event_id = 'dddd0040-4400-0000-0000-000000000040') >= 1,
  'alice can SELECT comments on her event'
);

-- 5. bob can SELECT comments on the event
set local "request.jwt.claims" to '{"sub":"bbbb0002-4400-0000-0000-000000000002","role":"authenticated"}';

select ok(
  (select count(*) from care_event_comments
    where care_event_id = 'dddd0040-4400-0000-0000-000000000040') >= 1,
  'bob can SELECT comments on the event'
);

-- 6. eve cannot SELECT any comments (empty result)
set local "request.jwt.claims" to '{"sub":"eeee0003-4400-0000-0000-000000000003","role":"authenticated"}';

select ok(
  (select count(*) from care_event_comments
    where care_event_id = 'dddd0040-4400-0000-0000-000000000040') = 0,
  'eve (org_b) cannot SELECT org_a comments'
);

-- 7. alice can UPDATE her own comment body
set local "request.jwt.claims" to '{"sub":"aaaa0001-4400-0000-0000-000000000001","role":"authenticated"}';

update care_event_comments
  set body = 'Alice updated comment', edited_at = now()
  where id = 'ffff0050-4400-0000-0000-000000000050';

select ok(
  (select body from care_event_comments where id = 'ffff0050-4400-0000-0000-000000000050') = 'Alice updated comment',
  'alice can UPDATE her own comment body'
);

-- 8. bob cannot UPDATE alice's comment (RLS silently skips, row unchanged)
set local "request.jwt.claims" to '{"sub":"bbbb0002-4400-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$
    update care_event_comments
      set body = 'Bob tries to edit alice comment'
      where id = 'ffff0050-4400-0000-0000-000000000050'
  $$,
  'bob UPDATE attempt does not throw (RLS silently skips)'
);

select ok(
  (select body from care_event_comments where id = 'ffff0050-4400-0000-0000-000000000050') <> 'Bob tries to edit alice comment',
  'bob cannot UPDATE alice''s comment body (row unchanged)'
);

-- 9. alice can soft-delete her own comment (UPDATE set deleted_at)
set local "request.jwt.claims" to '{"sub":"aaaa0001-4400-0000-0000-000000000001","role":"authenticated"}';

update care_event_comments
  set deleted_at = now()
  where id = 'ffff0050-4400-0000-0000-000000000050';

select ok(
  (select deleted_at from care_event_comments where id = 'ffff0050-4400-0000-0000-000000000050') is not null,
  'alice can soft-delete her own comment (set deleted_at)'
);

-- 10. bob cannot soft-delete alice's comment (RLS silently skips)
set local "request.jwt.claims" to '{"sub":"bbbb0002-4400-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$
    update care_event_comments
      set deleted_at = '1970-01-01'::timestamptz
      where id = 'ffff0050-4400-0000-0000-000000000050'
  $$,
  'bob soft-delete attempt does not throw (RLS silently skips)'
);

-- alice's deleted_at should still be the value she set (not epoch), confirming bob's update was blocked
select ok(
  (select deleted_at from care_event_comments where id = 'ffff0050-4400-0000-0000-000000000050') <> '1970-01-01'::timestamptz,
  'bob cannot soft-delete alice''s comment (deleted_at unchanged)'
);

-- 11. hard DELETE is silently skipped for author (lives_ok + row still exists)
set local "request.jwt.claims" to '{"sub":"aaaa0001-4400-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$delete from care_event_comments where id = 'ffff0050-4400-0000-0000-000000000050'$$,
  'hard DELETE does not throw (RLS silently skips)'
);

set local role postgres;
select ok(
  (select count(*) from care_event_comments where id = 'ffff0050-4400-0000-0000-000000000050') = 1,
  'row still exists after hard DELETE attempt (no DELETE policy)'
);

-- 12. body CHECK rejects empty string → 23514
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaa0001-4400-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$
    insert into care_event_comments (care_event_id, org_id, author_id, body)
    values (
      'dddd0040-4400-0000-0000-000000000040',
      'aaaa0010-4400-0000-0000-000000000010',
      'aaaa0001-4400-0000-0000-000000000001',
      ''
    )
  $$,
  '23514',
  NULL,
  'body CHECK rejects empty string'
);

select finish();
rollback;
