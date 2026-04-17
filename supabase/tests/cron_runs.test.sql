begin;

select plan(4);

-- 1. Table exists
select has_table('public', 'cron_runs', 'cron_runs table exists');

-- 2. RLS is enabled
select ok(
  (select relrowsecurity from pg_class where relname = 'cron_runs' and relnamespace = 'public'::regnamespace),
  'RLS is enabled on cron_runs'
);

-- 3. No public SELECT policy (deny-by-default)
select is(
  (select count(*)::int from pg_policies where tablename = 'cron_runs' and schemaname = 'public'),
  0,
  'No RLS policies on cron_runs — deny all public access'
);

-- 4. last_status check constraint rejects invalid values
do $$
begin
  begin
    insert into public.cron_runs (function_id, last_ran_at, last_status)
    values ('test-fn', now(), 'invalid');
    raise exception 'Expected check constraint violation';
  exception when check_violation then
    -- expected
  end;
end;
$$;

select ok(true, 'last_status check constraint rejects invalid values');

select * from finish();

rollback;
