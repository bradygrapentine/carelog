-- PP-005: Web Push Notifications — subscription storage

-- 1. New table: web_push_subscriptions
create table public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh_key text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

-- 2. RLS
alter table public.web_push_subscriptions enable row level security;

-- Users can read their own subscriptions
create policy "web_push: user reads own" on public.web_push_subscriptions
  for select using (auth_user_id = auth.uid());

-- Users can insert their own
create policy "web_push: user inserts own" on public.web_push_subscriptions
  for insert with check (auth_user_id = auth.uid());

-- Users can delete their own (unsubscribe)
create policy "web_push: user deletes own" on public.web_push_subscriptions
  for delete using (auth_user_id = auth.uid());

-- Service role can read all (for sending notifications)
create policy "web_push: service role reads all" on public.web_push_subscriptions
  for select using (auth.role() = 'service_role');

-- 3. web_push_enabled column on notification_preferences
-- Moved to 20260421000001_pp005_web_push_enabled_pref.sql because
-- notification_preferences isn't created until 20260421000000.
