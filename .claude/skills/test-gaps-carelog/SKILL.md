# Test coverage gap analysis

**READ-ONLY. Do NOT edit any files. Do NOT write new tests during this skill.**

Produce a single report identifying the most valuable missing tests. Stop after the report.

## Process

1. Identify the surface the user cares about (default: everything under `apps/web/` and `supabase/`).
2. Enumerate source files and match against tests:
   - Components in `apps/web/app/**/*.tsx` and `apps/web/components/**/*.tsx` → corresponding `__tests__/*.test.tsx`
   - tRPC routers in `apps/web/server/routers/*.ts` → corresponding `__tests__/*.logic.test.ts` and `*.security.test.ts`
   - API routes in `apps/web/app/api/**/route.ts` → `route.test.ts`
   - Inngest functions in `apps/web/inngest/functions/*.ts` → `__tests__/*.test.ts`
   - Supabase tables + RLS policies in `supabase/migrations/*.sql` → `supabase/tests/*_rls.test.sql`
   - User-facing flows reachable from the app shell → `e2e/*.spec.ts`
3. Rank gaps by risk:
   - **Critical**: security-adjacent code with zero tests (RLS policies, auth, PHI boundaries, billing, invites)
   - **High**: business logic / mutations without logic tests
   - **Medium**: UI with no render test
   - **Low**: utility functions or dead code
4. Emit a single table and stop. Format:

```
| Surface | File | Priority | Gap | Suggested test file |
|---------|------|----------|-----|---------------------|
| RLS     | supabase/migrations/.../foo.sql | Critical | no pgTAP | supabase/tests/foo_rls.test.sql |
| Router  | apps/web/server/routers/bar.ts  | High     | no logic test | server/routers/__tests__/bar.logic.test.ts |
```

5. Recommend the top 3 to tackle first, with one-line justification each.

## Rules

- Do not invoke Edit or Write. The deliverable is the report.
- Do not run `pnpm vitest` or `supabase test db` during this skill — file presence + name conventions are enough signal.
- Do not chase every untested utility. Favor code paths that would cause PHI leaks, incorrect billing, or silent RLS bypasses.
- Stop after the report is posted. The user will pick a gap and dispatch implementation work separately.
