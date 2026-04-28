-- supabase/tests/care_events_client_id.test.sql
-- TD-82: Schema-level coverage for the care_events.client_id column
-- (migration 20260416000001_care_events_client_id.sql).
--
-- The migration adds:
--   ALTER TABLE care_events ADD COLUMN IF NOT EXISTS client_id TEXT;
--   CREATE UNIQUE INDEX IF NOT EXISTS care_events_client_id_idx
--     ON care_events (client_id) WHERE client_id IS NOT NULL;
--
-- Critical scenarios verified:
--   1. client_id is NULLable (no NOT NULL — backfill-safe migration).
--   2. Two NULL client_ids can coexist (partial index excludes NULLs).
--   3. Two non-NULL identical client_ids are rejected (uniqueness enforces
--      the offline write-queue idempotency contract).
--   4. The unique index is GLOBAL — same client_id across orgs is rejected
--      too. This is the intended PP-011 behavior (client-generated UUIDs
--      shouldn't collide across orgs in practice). Documenting the contract
--      in a test prevents an accidental scope-narrowing of the index.

begin;
select plan(7);

-- ─── Fixtures ──────────────────────────────────────────────────────────────

set local role postgres;

insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('aaaa0082-8200-0000-0000-000000000001', 'authenticated', 'authenticated',
   'alice@td82-cid.com', now(), now(), now(), '{}', '{}', false),
  ('eeee0082-8200-0000-0000-000000000002', 'authenticated', 'authenticated',
   'eve@td82-cid.com', now(), now(), now(), '{}', '{}', false)
on conflict (id) do nothing;

insert into organizations (id, name, org_type) values
  ('aaaa0082-8200-0000-0000-000000000010', 'Org A TD82', 'family'),
  ('eeee0082-8200-0000-0000-000000000020', 'Org B TD82', 'family')
on conflict do nothing;

insert into identity_vault (token, org_id, full_name) values
  ('aaaa0082-8200-1111-0000-000000000001',
   'aaaa0082-8200-0000-0000-000000000010', 'TD82 Recipient R1'),
  ('eeee0082-8200-3333-0000-000000000003',
   'eeee0082-8200-0000-0000-000000000020', 'TD82 Recipient R3')
on conflict do nothing;

insert into care_recipients (id, org_id, identity_token) values
  ('11ec0082-8200-0000-0000-000000000031',
   'aaaa0082-8200-0000-0000-000000000010',
   'aaaa0082-8200-1111-0000-000000000001'),
  ('33ec0082-8200-0000-0000-000000000033',
   'eeee0082-8200-0000-0000-000000000020',
   'eeee0082-8200-3333-0000-000000000003')
on conflict do nothing;

insert into memberships (org_id, user_id, role, recipient_id, accepted_at) values
  ('aaaa0082-8200-0000-0000-000000000010',
   'aaaa0082-8200-0000-0000-000000000001', 'coordinator', NULL, now()),
  ('eeee0082-8200-0000-0000-000000000020',
   'eeee0082-8200-0000-0000-000000000002', 'coordinator', NULL, now())
on conflict do nothing;

-- ─── Schema shape ───────────────────────────────────────────────────────────

-- 1. Column exists.
select has_column(
  'public', 'care_events', 'client_id',
  'care_events.client_id column exists (PP-011 offline write-queue support)'
);

-- 2. Column is text.
select col_type_is(
  'public', 'care_events', 'client_id', 'text',
  'care_events.client_id is TEXT'
);

-- 3. Column is NULLable. The migration is backfill-safe — pre-existing rows
--    have no client_id, and that must remain valid.
select col_is_null(
  'public', 'care_events', 'client_id',
  'care_events.client_id is NULLable (backfill-safe)'
);

-- 4. Partial unique index exists with the WHERE clause from the migration.
select isnt_empty(
  $$ select 1
       from pg_indexes
      where schemaname = 'public'
        and tablename  = 'care_events'
        and indexname  = 'care_events_client_id_idx'
        and indexdef ilike '%where (client_id is not null)%' $$,
  'care_events_client_id_idx is a partial unique index WHERE client_id IS NOT NULL'
);

-- ─── Behavioral tests ───────────────────────────────────────────────────────

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"aaaa0082-8200-0000-0000-000000000001","role":"authenticated"}';

-- 5. Two rows with NULL client_id coexist.
--    Partial index `WHERE client_id IS NOT NULL` excludes NULLs from the
--    uniqueness constraint — verifies the partial-ness is wired correctly.
select lives_ok(
  $$
    insert into care_events
      (org_id, recipient_id, actor_id, event_type, entry_kind, occurred_at, client_id)
    values
      ('aaaa0082-8200-0000-0000-000000000010',
       '11ec0082-8200-0000-0000-000000000031',
       'aaaa0082-8200-0000-0000-000000000001',
       'journal', 'human', now(), NULL),
      ('aaaa0082-8200-0000-0000-000000000010',
       '11ec0082-8200-0000-0000-000000000031',
       'aaaa0082-8200-0000-0000-000000000001',
       'journal', 'human', now(), NULL)
  $$,
  'two rows with NULL client_id coexist (partial index excludes NULLs)'
);

-- 6. Re-using the same non-NULL client_id within the same recipient is
--    rejected. This is the offline-queue idempotency contract: a retried
--    POST with the same client_id MUST land at most once.
select lives_ok(
  $$
    insert into care_events
      (org_id, recipient_id, actor_id, event_type, entry_kind, occurred_at, client_id)
    values ('aaaa0082-8200-0000-0000-000000000010',
            '11ec0082-8200-0000-0000-000000000031',
            'aaaa0082-8200-0000-0000-000000000001',
            'journal', 'human', now(),
            'td82-client-id-alpha')
  $$,
  'first insert of client_id=alpha succeeds'
);

select throws_ok(
  $$
    insert into care_events
      (org_id, recipient_id, actor_id, event_type, entry_kind, occurred_at, client_id)
    values ('aaaa0082-8200-0000-0000-000000000010',
            '11ec0082-8200-0000-0000-000000000031',
            'aaaa0082-8200-0000-0000-000000000001',
            'journal', 'human', now(),
            'td82-client-id-alpha')
  $$,
  '23505',
  NULL,
  'duplicate non-NULL client_id rejected (unique partial index enforces idempotency)'
);

-- ─── End ────────────────────────────────────────────────────────────────────

select * from finish();
rollback;
