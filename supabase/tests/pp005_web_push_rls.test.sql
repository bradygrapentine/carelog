-- supabase/tests/pp005_web_push_rls.test.sql
-- PP-005: RLS coverage for web_push_subscriptions + notification_preferences.web_push_enabled
begin;
select plan(13);

-- ─── Fixtures ──────────────────────────────────────────────────────────────

set local role postgres;

-- Users: alice, bob (distinct users to test cross-user isolation)
insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('aa010001-5500-0000-0000-000000000001', 'authenticated', 'authenticated',
   'alice@pp005-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bb020002-5500-0000-0000-000000000002', 'authenticated', 'authenticated',
   'bob@pp005-rls.com', now(), now(), now(), '{}', '{}', false)
on conflict (id) do nothing;

-- Alice's subscription (pre-seeded for read/delete tests)
insert into web_push_subscriptions (id, auth_user_id, endpoint, p256dh_key, auth_key)
values (
  'cc030003-5500-0000-0000-000000000003',
  'aa010001-5500-0000-0000-000000000001',
  'https://fcm.googleapis.com/alice-endpoint',
  'alice-p256dh-key',
  'alice-auth-key'
) on conflict do nothing;

-- ─── 1. Anonymous cannot SELECT ────────────────────────────────────────────

set local role anon;
set local "request.jwt.claims" to '';

select results_eq(
  $$select count(*)::int from web_push_subscriptions$$,
  array[0]::int[],
  'anon cannot SELECT web_push_subscriptions'
);

-- ─── 2. Anonymous cannot INSERT ────────────────────────────────────────────

select throws_ok(
  $$
    insert into web_push_subscriptions (auth_user_id, endpoint, p256dh_key, auth_key)
    values (
      'aa010001-5500-0000-0000-000000000001',
      'https://fcm.googleapis.com/anon-endpoint',
      'anon-p256dh-key',
      'anon-auth-key'
    )
  $$,
  '42501',
  NULL,
  'anon cannot INSERT web_push_subscriptions'
);

-- ─── 3. Anonymous cannot DELETE ────────────────────────────────────────────

select lives_ok(
  $$delete from web_push_subscriptions where id = 'cc030003-5500-0000-0000-000000000003'$$,
  'anon DELETE does not throw (RLS silently skips)'
);

set local role postgres;
select ok(
  (select count(*) from web_push_subscriptions where id = 'cc030003-5500-0000-0000-000000000003') = 1,
  'alice row still exists after anon DELETE attempt'
);

-- ─── 4. User A cannot read User B's subscriptions ──────────────────────────

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"bb020002-5500-0000-0000-000000000002","role":"authenticated"}';

select results_eq(
  $$select count(*)::int from web_push_subscriptions where auth_user_id = 'aa010001-5500-0000-0000-000000000001'$$,
  array[0]::int[],
  'bob cannot SELECT alice''s subscriptions'
);

-- ─── 5. User can INSERT their own subscription ─────────────────────────────

set local "request.jwt.claims" to '{"sub":"aa010001-5500-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$
    insert into web_push_subscriptions (auth_user_id, endpoint, p256dh_key, auth_key)
    values (
      'aa010001-5500-0000-0000-000000000001',
      'https://fcm.googleapis.com/alice-new-endpoint',
      'alice-new-p256dh-key',
      'alice-new-auth-key'
    )
  $$,
  'alice can INSERT her own subscription'
);

-- ─── 6. User can INSERT then read back their own subscriptions ─────────────

select ok(
  (select count(*) from web_push_subscriptions where auth_user_id = 'aa010001-5500-0000-0000-000000000001') >= 1,
  'alice can SELECT her own subscriptions'
);

-- ─── 7. User cannot INSERT a subscription for another user ─────────────────

set local "request.jwt.claims" to '{"sub":"bb020002-5500-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$
    insert into web_push_subscriptions (auth_user_id, endpoint, p256dh_key, auth_key)
    values (
      'aa010001-5500-0000-0000-000000000001',
      'https://fcm.googleapis.com/bob-spoofing-alice',
      'spoof-p256dh-key',
      'spoof-auth-key'
    )
  $$,
  '42501',
  NULL,
  'bob cannot INSERT a subscription for alice (cross-user spoof)'
);

-- ─── 8. User can DELETE their own subscription ─────────────────────────────

set local "request.jwt.claims" to '{"sub":"aa010001-5500-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$delete from web_push_subscriptions where id = 'cc030003-5500-0000-0000-000000000003'$$,
  'alice can DELETE her own subscription'
);

set local role postgres;
select ok(
  (select count(*) from web_push_subscriptions where id = 'cc030003-5500-0000-0000-000000000003') = 0,
  'alice''s subscription is gone after her DELETE'
);

-- ─── 9. Service role can read all subscriptions ────────────────────────────

-- Re-insert alice's row (was just deleted) so service_role has something to read
insert into web_push_subscriptions (id, auth_user_id, endpoint, p256dh_key, auth_key)
values (
  'cc030003-5500-0000-0000-000000000003',
  'aa010001-5500-0000-0000-000000000001',
  'https://fcm.googleapis.com/alice-endpoint',
  'alice-p256dh-key',
  'alice-auth-key'
) on conflict do nothing;

set local role service_role;
set local "request.jwt.claims" to '{"role":"service_role"}';

select ok(
  (select count(*) from web_push_subscriptions) >= 1,
  'service_role can SELECT all web_push_subscriptions'
);

-- ─── 10. notification_preferences.web_push_enabled column exists + default ─

set local role postgres;

select ok(
  (
    select column_default = 'true'
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'notification_preferences'
      and column_name  = 'web_push_enabled'
  ),
  'notification_preferences.web_push_enabled column exists with default true'
);

select ok(
  (
    select data_type = 'boolean'
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'notification_preferences'
      and column_name  = 'web_push_enabled'
  ),
  'notification_preferences.web_push_enabled is boolean type'
);

select * from finish();
rollback;
