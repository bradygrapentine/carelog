create table if not exists public.cron_runs (
  function_id   text primary key,
  last_ran_at   timestamptz not null default now(),
  last_status   text not null check (last_status in ('ok', 'error')),
  error_message text
);

-- RLS enabled — no public policies = deny all public access.
-- The health endpoint and cron upserts use supabaseAdmin (service role) which bypasses RLS.
alter table public.cron_runs enable row level security;
