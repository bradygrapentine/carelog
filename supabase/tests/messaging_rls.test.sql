-- supabase/tests/messaging_rls.test.sql
begin;
select plan(12);

-- ─── Fixtures ──────────────────────────────────────────────────────────────

set local role postgres;

insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('aa000001-1100-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@msg-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bb000002-1100-0000-0000-000000000002', 'authenticated', 'authenticated',
   'caregiver@msg-rls.com', now(), now(), now(), '{}', '{}', false),
  ('cc000003-1100-0000-0000-000000000003', 'authenticated', 'authenticated',
   'supporter@msg-rls.com', now(), now(), now(), '{}', '{}', false)
on conflict (id) do nothing;

insert into organizations (id, name, org_type)
values ('dd000001-1100-0000-0000-000000000001', 'Msg RLS Org', 'family')
on conflict do nothing;

insert into memberships (org_id, user_id, role, accepted_at)
values
  ('dd000001-1100-0000-0000-000000000001', 'aa000001-1100-0000-0000-000000000001', 'coordinator', now()),
  ('dd000001-1100-0000-0000-000000000001', 'bb000002-1100-0000-0000-000000000002', 'caregiver',   now()),
  ('dd000001-1100-0000-0000-000000000001', 'cc000003-1100-0000-0000-000000000003', 'supporter',   now())
on conflict do nothing;

-- Create a DM thread between coord and caregiver (as postgres to bypass RLS)
insert into public.message_threads(id, org_id, thread_type, created_by)
  values ('ee000001-1100-0000-0000-000000000001',
          'dd000001-1100-0000-0000-000000000001',
          'dm',
          'aa000001-1100-0000-0000-000000000001')
on conflict do nothing;

insert into public.message_thread_members(thread_id, user_id)
  values ('ee000001-1100-0000-0000-000000000001', 'aa000001-1100-0000-0000-000000000001'),
         ('ee000001-1100-0000-0000-000000000001', 'bb000002-1100-0000-0000-000000000002')
on conflict do nothing;

insert into public.messages(id, thread_id, sender_id, body)
  values ('ff000001-1100-0000-0000-000000000001',
          'ee000001-1100-0000-0000-000000000001',
          'aa000001-1100-0000-0000-000000000001',
          'Hello!')
on conflict do nothing;

-- ─── Tests ─────────────────────────────────────────────────────────────────

-- 1. Thread member (coordinator) can see the thread
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aa000001-1100-0000-0000-000000000001","role":"authenticated"}';

select ok(
  (select count(*) from public.message_threads where id='ee000001-1100-0000-0000-000000000001') = 1,
  'coordinator can see their thread'
);

-- 2. Thread member can read messages
select ok(
  (select count(*) from public.messages where thread_id='ee000001-1100-0000-0000-000000000001') = 1,
  'thread member can read messages'
);

-- 3. Thread member can see other members
select ok(
  (select count(*) from public.message_thread_members where thread_id='ee000001-1100-0000-0000-000000000001') = 2,
  'thread member can see all members of thread'
);

-- 4. Non-member (supporter) cannot see thread
set local "request.jwt.claims" to '{"sub":"cc000003-1100-0000-0000-000000000003","role":"authenticated"}';

select ok(
  (select count(*) from public.message_threads where id='ee000001-1100-0000-0000-000000000001') = 0,
  'non-member cannot see thread'
);

-- 5. Non-member cannot see messages
select ok(
  (select count(*) from public.messages where thread_id='ee000001-1100-0000-0000-000000000001') = 0,
  'non-member cannot read messages'
);

-- 6. Non-member cannot see thread membership list
select ok(
  (select count(*) from public.message_thread_members where thread_id='ee000001-1100-0000-0000-000000000001') = 0,
  'non-member cannot see thread member list'
);

-- 7. Anon cannot see anything
set local role anon;

select ok(
  (select count(*) from public.message_threads) = 0,
  'anon cannot see message threads'
);
select ok(
  (select count(*) from public.messages) = 0,
  'anon cannot see messages'
);
select ok(
  (select count(*) from public.message_thread_members) = 0,
  'anon cannot see thread members'
);

-- 8. Member can update their own last_read_at
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aa000001-1100-0000-0000-000000000001","role":"authenticated"}';

update public.message_thread_members
  set last_read_at = now()
  where thread_id = 'ee000001-1100-0000-0000-000000000001'
    and user_id = 'aa000001-1100-0000-0000-000000000001';

select ok(
  (select last_read_at from public.message_thread_members
    where thread_id='ee000001-1100-0000-0000-000000000001'
      and user_id='aa000001-1100-0000-0000-000000000001'
  ) is not null,
  'member can update their own last_read_at'
);

-- 9. Caregiver cannot update coordinator last_read_at
set local "request.jwt.claims" to '{"sub":"bb000002-1100-0000-0000-000000000002","role":"authenticated"}';

update public.message_thread_members
  set last_read_at = 'epoch'::timestamptz
  where thread_id = 'ee000001-1100-0000-0000-000000000001'
    and user_id = 'aa000001-1100-0000-0000-000000000001';

select ok(
  (select last_read_at from public.message_thread_members
    where thread_id='ee000001-1100-0000-0000-000000000001'
      and user_id='aa000001-1100-0000-0000-000000000001'
  ) <> 'epoch'::timestamptz,
  'caregiver cannot update coordinator last_read_at'
);

-- 10. Sender can soft-delete their own message
set local "request.jwt.claims" to '{"sub":"aa000001-1100-0000-0000-000000000001","role":"authenticated"}';

update public.messages set deleted_at = now()
  where id = 'ff000001-1100-0000-0000-000000000001';

select ok(
  (select deleted_at from public.messages where id='ff000001-1100-0000-0000-000000000001') is not null,
  'sender can soft-delete their own message'
);

select finish();
rollback;
