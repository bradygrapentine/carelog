# Supabase — Migrations, RLS, Tests

## Commands

```sh
supabase start       # must be running before tests
supabase test db     # run all pgTAP tests
```

The `pgTAP` hook auto-runs `supabase test db` when auth/RLS/migration files are edited.

## pgTAP Test Rules (hard-won from past failures)

- `throws_ok` signature: use 4-arg form `throws_ok($$...$$, 'error_code', NULL, 'message')` — NULL for message-match, last arg is the test label
- `auth.users` FK constraints: insert into `auth.users` directly before inserting dependent rows, or use `supabase_test.create_supabase_user()`
- Never use DML (INSERT/UPDATE/DELETE) inside a subquery in pgTAP tests
- Enum columns: never CREATE TYPE inside a transaction — run migrations with `BEGIN; ... COMMIT;` outside pgTAP
- DELETE tests: use `lives_ok` + `results_eq` to verify row still exists — RLS silently skips DELETE, doesn't throw

## URL Rule

Use `localhost:54321` for Supabase — see `docs/project-info/technology/CODE_STANDARDS.md` for rationale.

## Tooling

- `/create-migration` — scaffold a new migration + matching pgTAP test with rules baked in
- **rls-reviewer** agent — invoke after writing migrations or `supabase/tests/` files to check for PHI security gaps before committing
