# Implementation Plan — TD-142 invite-acceptance state-machine collapse

**Date:** 2026-05-17
**Slug:** `td-142-invite-rpc-collapse`
**Source row:** TD-142 (P2 / Medium)
**Mode:** direct (1 track, ~30-45 min)

## Discovery that simplifies the plan

Both production callers of `acceptInvite` already use the SQL RPC directly. Verified at HEAD `d60fcce` (reproducible with `grep -rn 'acceptInvite\|accept_invite' apps/web/server/routers/memberships.ts apps/web/app/api/invite`):
- `apps/web/server/routers/memberships.ts:89` → `supabaseAdmin.rpc("accept_invite", ...)`
- `apps/web/app/api/invite/[token]/accept/route.ts:20` → `supabaseAdmin.rpc("accept_invite", ...)`

The TS `acceptInvite()` function in `apps/web/server/repositories/membershipsRepository.ts:163-200` is **dead code in production** — only consumed by its own tests and a mocked stub in `inputSchemas.test.ts`. The atomicity hole TD-142 was meant to fix is theoretical (no live path exercises it).

This collapses TD-142 from "flip a state machine" to "delete dead code with a known-bad pattern before someone resurrects it."

## Goal

Delete the racy TS `acceptInvite` function and its tests. Production paths (tRPC + HTTP) unchanged. Documentation comment added pointing the next reader at the SQL function as the single source of truth.

## Track A — TD-142 dead-code deletion

**Branch:** `fix/td-142-invite-rpc-collapse`
**Files allowed:**
- `apps/web/server/repositories/membershipsRepository.ts` (delete `acceptInvite` function, lines 163-200; update line 128 comment that references it)
- `apps/web/server/repositories/__tests__/membershipsRepository.test.ts` (delete the `describe("acceptInvite state machine", ...)` block and the import)
- `apps/web/server/routers/__tests__/inputSchemas.test.ts` (delete the `acceptInvite: vi.fn()` mock if no longer referenced — verify)

**Work:**
1. Read `inputSchemas.test.ts` and confirm whether `acceptInvite` is actively asserted on (it's currently just a mock entry). If only mocked, remove the line. If asserted on, leave the mock and document why in this plan's "out of scope" section.
2. Delete the `acceptInvite` function body in `membershipsRepository.ts`. Replace with a comment block pointing readers at:
   - The SQL function in `supabase/migrations/20260407000000_atomic_invite_accept.sql` (semantics)
   - The REVOKE in `20260516000000_revoke_accept_invite_from_anon_authenticated.sql` (access control)
   - The two production callers (tRPC + HTTP route) for usage examples
3. Delete the `describe("acceptInvite state machine", ...)` block in `membershipsRepository.test.ts`. Remove the `acceptInvite` from the import statement.
4. Update the `// by acceptInvite()` comment at line 128 to `// by the accept_invite SQL RPC` — no longer contains the camelCase identifier.
5. **Pre-merge router-import check:** `grep -rn "import.*acceptInvite\|from.*membershipsRepository" apps/web/server/routers` must show ZERO matches for `acceptInvite`. Catches any future barrel re-export the surface grep missed.
6. Run vitest + grep + typecheck to confirm no dangling references.

**Acceptance:**
- `grep -rn "acceptInvite" apps/web` returns ZERO matches (the line-128 comment was updated; no executable code references; no test imports).
- Step 5's import grep also returns zero.
- Full web test suite passes (~2160+ tests).
- `supabase test db` runs locally and the existing `accept_invite` pgTAP cases (per `supabase/tests/`) stay green — confirms the RPC contract this PR pivots on hasn't drifted.
- `cd apps/web && npx tsc --noEmit` clean.
- ESLint quiet on changed files.

## Security findings coverage (from .claude/state/owasp-threat-td-142-invite-rpc-collapse.md)

The /owasp pre-plan review enumerated 1 Critical + 2 High + 4 Medium + 3 Low. All addressable in this plan or already in place:

| Finding | Status under this plan |
|---|---|
| **T1 (Crit) — Race / double-consumption.** Delete TS body, no fallback. | ✓ Plan deletes the body. |
| **T2 (High) — Email-mismatch / trim normalization.** Verify `p_email` comes from JWT session, not request body. | ✓ Both production callers use `user.email` from JWT (`memberships.ts:89` reads `ctx.user.email`; HTTP route at `app/api/invite/[token]/accept/route.ts` reads `getRequestUser` JWT). No code change needed; document in PR. |
| **T3 (High) — anon/authenticated direct RPC.** REVOKE migration must be applied + pgTAP cases 8+9 in CI. | ✓ Migration `20260516000000` already on main. Verify pgTAP suite includes cases 8+9 in `supabase/tests/`. If not, seed a follow-up row — but do NOT add the CI gate in this PR (scope creep). |
| **T4 (Med) — Role escalation via param.** Confirm SQL function doesn't update `role` from caller input. | ✓ Read the SQL function — only `user_id` + `accepted_at` set. Document. |
| **T5 (Med) — SECURITY DEFINER over-elevation.** No dynamic SQL, search_path locked, parameterized. | ✓ Document — already true on main. |
| **T6 (Med) — Token enumeration timing oracle.** Rate limiter strictness + CSPRNG. | Verify in PR description; if rate limit is loose, seed follow-up row. Do NOT widen scope here. |
| **T7 (Med) — Expiry TOCTOU.** SQL function evaluates `expires_at > now()` in-tx. | ✓ Already true; deletion of TS body eliminates the cross-process clock variant. |
| **T8 (Low→Med) — PHI/token leak via `data.error` fallback.** Reviewer flagged this is closer to Medium because Postgres error strings can include parameterized values. Guard the route's JSON fallback so it can't echo tokens. | Verify in PR description. The route's error-handling code is OUT of scope (no behavior change in this PR). If unguarded, seed TD-167 with the route+line cite. |
| **T9 (Low) — Dead-code residue.** Sweep all `acceptInvite` callers. | ✓ This IS the work. |
| **T10 (Low) — Audit / forensics on failure paths.** Structured logs for `email_mismatch` / repeated `not_found`. | Out of scope. Note for future. |

## Risks accepted

- T6 + T8 verifications are documentation-only in this PR (the surface isn't touched). If verification finds an issue, seed a TD-* follow-up rather than expanding scope.
- The `inputSchemas.test.ts` mock removal could break unrelated tests if the mock is implicitly relied on. Mitigated by running full suite locally before push.

## Out of scope

- Adding the pgTAP CI gate (T3 acceptance signal) if it's not already wired.
- Tightening the route-handler error responses (T8).
- Tightening the rate limiter (T6).
- Structured logging for invite-acceptance failure paths (T10).

All four become follow-up TD-* rows if needed.
