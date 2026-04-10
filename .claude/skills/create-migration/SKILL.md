---
name: create-migration
description: Scaffold a new Supabase migration file and matching pgTAP test, with reminders of hard-won pgTAP rules
user-invocable: true
---

# Create Migration

Scaffold a new Supabase migration and pgTAP test file for the given feature.

## Steps

1. **Determine the next migration number**
   ```bash
   ls supabase/migrations/ | tail -5
   ```
   Use the next sequential timestamp: `YYYYMMDDHHMMSS_<name>.sql`

2. **Create the migration file** at `supabase/migrations/<timestamp>_<name>.sql`

   Standard structure:
   ```sql
   -- Migration: <description>
   -- Affected tables: <list>

   -- Table definition
   CREATE TABLE IF NOT EXISTS <name> (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
     created_at timestamptz NOT NULL DEFAULT now()
   );

   -- RLS
   ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "<name>_select" ON <name>
     FOR SELECT USING (
       family_id IN (
         SELECT family_id FROM family_members WHERE user_id = auth.uid()
       )
     );

   -- Add INSERT / UPDATE / DELETE policies as needed
   ```

3. **Create the pgTAP test file** at `supabase/tests/<name>_rls.test.sql`

   Standard structure:
   ```sql
   BEGIN;
   SELECT plan(N); -- update N to match test count

   -- Fixtures
   SELECT supabase_test.create_supabase_user('test-user-id-here');
   INSERT INTO auth.users (id, email) VALUES ('other-user-id', 'other@test.com');

   -- Test: owner can SELECT
   SELECT lives_ok(
     $$ SELECT * FROM <name> WHERE user_id = 'test-user-id-here' $$,
     'owner can select own rows'
   );

   -- Test: other user blocked
   SET LOCAL role TO authenticated;
   SET LOCAL "request.jwt.claims" TO '{"sub": "other-user-id"}';

   SELECT is_empty(
     $$ SELECT * FROM <name> $$,
     'other user sees no rows'
   );

   -- Test: DELETE silently skips (RLS does not throw)
   SELECT lives_ok(
     $$ DELETE FROM <name> WHERE id = '<row-id>' $$,
     'delete attempt does not throw'
   );
   SELECT results_eq(
     $$ SELECT count(*)::int FROM <name> WHERE id = '<row-id>' $$,
     $$ VALUES (1) $$,
     'row still exists after blocked delete'
   );

   SELECT * FROM finish();
   ROLLBACK;
   ```

## Hard-Won pgTAP Rules (from CLAUDE.md)

- `throws_ok` — use 3-arg form: `throws_ok($$...$$, 'error_code', 'label')`
- `auth.users` FK — insert into `auth.users` directly OR use `supabase_test.create_supabase_user()`
- No DML inside subqueries in pgTAP tests
- Never `CREATE TYPE` inside a transaction
- DELETE tests: always `lives_ok` + `results_eq` (not `throws_ok`)
- UUIDs: all hex chars only (0-9, a-f) — no `g` or other chars

## After Scaffolding

Run to verify test file is valid:
```bash
supabase test db
```

Then invoke the `rls-reviewer` agent to check policy completeness before committing.
