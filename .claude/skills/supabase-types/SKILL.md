---
name: supabase-types
description: Regenerate Supabase TypeScript types after migrations and update the types package
user-invocable: true
---

# Supabase Types

Regenerate TypeScript types from the local Supabase instance after running migrations.

## Prerequisite

`supabase start` must be running. If not:
```sh
supabase start
```

## Steps

### 1. Find the types output path
```sh
find packages/ apps/ -name "supabase.ts" -o -name "database.types.ts" | head -5
```

### 2. Regenerate types
```sh
supabase gen types typescript --local > <path-from-step-1>
```

Common path: `packages/types/supabase.ts`

### 3. Verify
```sh
pnpm typecheck
```

If typecheck fails, the schema change likely broke existing code — review the diff and fix usages.

## When to run

- After every `supabase db push` or new migration
- After `supabase/CLAUDE.md` reminds you post-migration
- Before dispatching DB-touching tasks to `/ollama` or a subagent (types must be regenerated first so the subordinate sees current schema)
