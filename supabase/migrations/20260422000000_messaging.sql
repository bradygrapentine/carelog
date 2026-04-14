-- supabase/migrations/20260422000000_messaging.sql

-- ─── Tables ────────────────────────────────────────────────────────────────

create type public.message_thread_type as enum ('dm', 'group');

create table public.message_threads (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  thread_type public.message_thread_type not null,
  name        text,                          -- null for DMs, required for group
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

create table public.message_thread_members (
  thread_id   uuid not null references public.message_threads(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz,                  -- null = never read
  joined_at   timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.message_threads(id) on delete cascade,
  sender_id   uuid not null references auth.users(id),
  body        text not null check (length(body) between 1 and 4000),
  created_at  timestamptz not null default now(),
  edited_at   timestamptz,
  deleted_at  timestamptz                    -- soft delete; null = active
);

-- ─── Indexes ───────────────────────────────────────────────────────────────

create index message_threads_org_idx on public.message_threads(org_id);
create index message_thread_members_user_idx on public.message_thread_members(user_id);
create index messages_thread_idx on public.messages(thread_id, created_at);

-- ─── RLS ───────────────────────────────────────────────────────────────────

alter table public.message_threads enable row level security;
alter table public.message_thread_members enable row level security;
alter table public.messages enable row level security;

-- Helper: is the requesting user a member of this thread?
create or replace function public.is_thread_member(p_thread_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.message_thread_members
    where thread_id = p_thread_id and user_id = auth.uid()
  );
$$;

-- message_threads: members can see their threads; service role can insert
create policy "thread members can select"
  on public.message_threads for select
  using (public.is_thread_member(id));

create policy "org members can insert thread"
  on public.message_threads for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.memberships
      where org_id = message_threads.org_id
        and user_id = auth.uid()
        and accepted_at is not null
    )
  );

-- message_thread_members: see members of threads you belong to; insert allowed by creator
create policy "thread members can see other members"
  on public.message_thread_members for select
  using (public.is_thread_member(thread_id));

create policy "thread creator can insert members"
  on public.message_thread_members for insert
  with check (
    exists (
      select 1 from public.message_threads
      where id = thread_id and created_by = auth.uid()
    )
  );

create policy "members can update own last_read_at"
  on public.message_thread_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- messages: thread members can read; members can insert (sender = self); sender can soft-delete
create policy "thread members can read messages"
  on public.messages for select
  using (public.is_thread_member(thread_id));

create policy "thread members can send messages"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_thread_member(thread_id)
  );

create policy "sender can soft-delete own message"
  on public.messages for update
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- ─── find_dm_thread helper ─────────────────────────────────────────────────

create or replace function public.find_dm_thread(
  p_user_a uuid, p_user_b uuid, p_org_id uuid
) returns uuid language sql security definer stable as $$
  select t.id
  from public.message_threads t
  where t.thread_type = 'dm'
    and t.org_id = p_org_id
    and (
      select count(*) from public.message_thread_members m
      where m.thread_id = t.id and m.user_id in (p_user_a, p_user_b)
    ) = 2
    and (
      select count(*) from public.message_thread_members m
      where m.thread_id = t.id
    ) = 2
  limit 1;
$$;
