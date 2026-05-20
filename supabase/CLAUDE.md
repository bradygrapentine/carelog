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

## SECURITY DEFINER + RLS (search_path & EXECUTE grants)

- **Pin `SET search_path = public, pg_temp`** on every `SECURITY DEFINER` function (CVE-2018-1058). Empty `''` is also acceptable (hardened). The project idiom is `public, pg_temp`; assert it in pgTAP via `'search_path=public, pg_temp' = ANY(proconfig)` keyed by `oid::regprocedure` (signature, not proname — catches overloads).
- **NEVER `REVOKE EXECUTE` from `authenticated`/`anon` on a DEFINER function used inside an RLS `USING`/`WITH CHECK` clause.** Postgres evaluates RLS expressions **as the querying role**, and a function call requires the *caller's* EXECUTE — `SECURITY DEFINER` changes the body's execution context, not the call-time check. Revoking an RLS-helper predicate (e.g. `user_in_org`, `user_is_org_member`, `is_thread_member`) from `authenticated` **crashes** every gated SELECT for normal users (TD-217 2026-05-20: reproduced; both opus-on-opus cycles missed it, local pgTAP caught it). Their hardening is the pinned search_path, not a REVOKE. Only REVOKE EXECUTE on DEFINER functions invoked **server-side as `service_role`** (RPCs like `accept_invite`, `confirm_ocr_job`).
- **`CREATE OR REPLACE` re-grants default privileges.** Supabase's default privileges `GRANT EXECUTE … TO anon, authenticated` on every function in `public`, so re-creating a function silently restores execute even if a prior migration REVOKEd it. Re-issue the REVOKE after any `CREATE OR REPLACE` of a previously-locked-down function (TD-129 / TD-217).

## URL Rule

Use `localhost:54321` for Supabase — see `docs/project-info/technology/CODE_STANDARDS.md` for rationale.

## Tooling

- `/create-migration` — scaffold a new migration + matching pgTAP test with rules baked in
- **rls-reviewer** agent — invoke after writing migrations or `supabase/tests/` files to check for PHI security gaps before committing. Also the right reviewer for `/sprint` post-wave `/robust` + `/test-quality` gates (Step 7e/7f) when the merged diff is RLS/migration-heavy — route those to rls-reviewer instead of a generic reviewer. (ON-77 2026-05-20: it caught DELETE-policy + transition-matrix pgTAP gaps a generic pass missed.)
