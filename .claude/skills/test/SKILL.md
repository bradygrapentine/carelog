## Test Writing Skill

1. Read any referenced docs FIRST before exploring code

2. For pgTAP RLS tests:
   - Call fixture functions as `postgres` role — it has bypassrls + INSERT on auth.users
   - After `CREATE TEMP TABLE _fix`: immediately run `GRANT SELECT ON _fix TO PUBLIC`
   - Switch users: `SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claims" TO '{"sub":"<uuid>","role":"authenticated"}'`
   - Update `plan(N)` to match the total test count or tests will fail
   - Run with: `supabase test db`

3. For Vitest unit/component tests:
   - Zod schemas reject empty strings — never pass empty required fields in test payloads
   - Use `fireEvent` not `userEvent` — `@testing-library/user-event` is not installed
   - Mock `supabaseAdmin.server` with `vi.mock` (hoisted) — the window guard throws in jsdom
   - Mock `next/headers` cookies() when importing tRPC routers
   - Run with: `npx vitest run`

4. For Playwright e2e:
   - Use non-strict locators (`getByRole`, `getByText`) — avoid strict CSS selectors
   - Never submit a form with empty required fields (Zod rejects them)
   - Use `signIn()` from `e2e/helpers.ts` for auth setup
   - Run with: `pnpm exec playwright test`

5. After writing tests, run them and fix all failures before reporting done
