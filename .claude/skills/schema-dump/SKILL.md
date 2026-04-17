---
name: schema-dump
description: Dump the current Postgres schema for named tables — columns, types, NOT NULL constraints, partial indexes with WHERE clauses, and RLS policies. Run this BEFORE writing any migration or seed SQL so you write correct SQL on the first try, not the fourth. Prevents ON CONFLICT mismatches, renamed-column assumptions, and invented tables.
user-invocable: true
---

# Schema Dump

Produce a verified schema snapshot before writing SQL. The `dev_data.sql` session history shows 4+ iterations of schema mismatches (ON CONFLICT on partial index, renamed columns) — each round burned tokens. This skill makes that a one-shot.

**Announce at start:** "Using /schema-dump to verify schema before writing SQL."

## When to run

- Before writing any new migration or seed.
- Before touching a tRPC router that inserts/updates rows (verify column names).
- When `/create-migration` is about to scaffold — this skill produces the schema input.

## Arguments

`/schema-dump <table1> [table2] [...]` — e.g. `/schema-dump memberships care_events shifts`.

If no tables are named, list the tables most-frequently-touched in the last 20 commits and ask.

## Process

### 1. Verify Supabase is running
```sh
curl -sf http://localhost:54321/rest/v1/ > /dev/null || {
  echo "Supabase not running — start with 'supabase start'"; exit 1
}
```

### 2. For each table, run through the local Postgres
```sh
PSQL="psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'"
```

Emit (to a single markdown output, no file):

**Columns + types + defaults + NOT NULL**
```sh
$PSQL -c "\d+ public.<table>"
```

**RLS policies**
```sh
$PSQL -c "SELECT polname, polcmd, polroles::regrole[], pg_get_expr(polqual, polrelid) AS using_clause, pg_get_expr(polwithcheck, polrelid) AS with_check FROM pg_policy WHERE polrelid = 'public.<table>'::regclass;"
```

**Indexes (including WHERE clauses for partial indexes — the ON CONFLICT trap)**
```sh
$PSQL -c "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='<table>';"
```

**Foreign keys**
```sh
$PSQL -c "\d+ public.<table>" | awk '/Foreign-key constraints:/{flag=1;next}/^$/{flag=0}flag'
```

### 3. Generated TS types
Check `apps/web/lib/database.types.ts` — if the table's type looks stale vs. the live schema, run `/supabase-types` to regenerate before trusting it.

### 4. Write the summary
Structure:
```
## <table>

### Columns
| Name | Type | NOT NULL | Default |
|---|---|---|---|
...

### Indexes
- `idx_name` on `(cols) [WHERE clause]`

### RLS
- `policy_name` (SELECT/INSERT/UPDATE/DELETE): USING `<expr>` WITH CHECK `<expr>`

### Foreign keys
- `col` → `other_table(col)` ON DELETE <action>
```

### 5. Highlight traps
If any of these are present, call them out at the top:
- **Partial indexes** (`CREATE INDEX ... WHERE ...`) — ON CONFLICT must match the exact predicate or inserts will duplicate.
- **Deferred constraints** — can fail at commit time, not at insert time.
- **Case-sensitive enum values** — list them literally.
- **Renamed columns in recent migrations** — grep `supabase/migrations/` for `RENAME COLUMN` on these tables.

## Rules

- **Never** write migration or seed SQL before running this skill on every affected table.
- Dump is plain text in the response — do NOT write a file unless the user asks.
- If the user says "just write the SQL" without a prior schema check, refuse and dump first.

## Integrations

- `/create-migration` — feed the dump into the migration scaffold.
- `/supabase-types` — regenerate `database.types.ts` if the dump reveals drift.
