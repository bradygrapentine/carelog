# Wave 5 Discovery Report — 2026-04-27

> **⚠ Deprecated merge-policy mention:** This document was written when the repo used Mergify and a `queue` label. As of 2026-05-10, Mergify is no longer in use; the canonical merge flow is `gh pr merge --auto --squash` via GitHub native auto-merge. References to Mergify / `--add-label queue` below are kept as historical record. See `.claude/CLAUDE.md` §Merge Policy.


Three parallel audits ran against `main` @ `dba7a07c`:
1. ✅ Test coverage gap analysis → `/tmp/wave5-test-gaps.md`
2. ✅ Pre-flight config + drift audit → inline (no file written)
3. ⚠️ Codex adversarial audit → **no output produced** (sandbox couldn't write `/tmp/wave5-codex-audit.md`; transcript truncated). Re-run advised before relying on this category of findings.

---

## Consolidated findings → new backlog rows

All rows below are 🟢 Ready unless marked otherwise. Add via a dedicated `chore(backlog): wave5 discovery` PR — do NOT bundle into feature PRs.

### CRITICAL — must address before LAUNCH-001 fires

| ID | Story | Why critical | Size |
|---|---|---|---|
| **TD-76** | **Regenerate `apps/web/lib/database.types.ts`** | Last regen Apr 16; latest migration `20260427000000_sec_high_fixes.sql` is today. Drift crosses security-hardening migrations — stale types can silently mask broken RLS enforcement on the type-checker side. Run `npx supabase gen types typescript --local 2>/dev/null > apps/web/lib/database.types.ts`, commit, verify `npx tsc --noEmit` still green. | 0.5 hr |

### HIGH — Tier 1 test coverage gaps (PHI/auth/payment)

| ID | Story | Risk | Size |
|---|---|---|---|
| **TD-77** | **Tests for `identityRepository.ts`** | PHI vault wrapper using `supabaseAdmin` (no RLS). Untested cross-org `resolveIdentity(token, org_id)` could leak names/DOB/contact between orgs in a silent regression. | 2 hr |
| **TD-78** | **Tests for `user.ts` tRPC router** | Zero auth-boundary tests. `IANA_TIMEZONE_PATTERN` regex untested for bypass; `dismissEducationTip` date math untested. | 1.5 hr |
| **TD-79** | **Tests for `careEventsRepository.ts`** | Core PHI write helper; no `validatePayload()` regression net + no org_id/recipient_id isolation test for `getTimeline`. RLS covers DB layer; this is the helper layer. | 1.5 hr |
| **TD-80** | **Tests for `lib/stripe.ts`** | Singleton init throws if `STRIPE_SECRET_KEY` missing — zero test asserting the error path. Affects every checkout/upgrade. | 0.5 hr |

### MEDIUM — close-out items

| ID | Story | Why | Size |
|---|---|---|---|
| **TD-81** | **Tests for `organizationsRepository.ts`** | Team-isolation queries untested. Cross-org leak vector for billing + admin views. | 1.5 hr |
| **TD-82** | **RLS test stub for `care_events_client_id` migration** | `20260416000001_care_events_client_id.sql` has no dedicated test. Either add minimal test or document why it's covered by `care_events_rls.test.sql`. | 0.5 hr |
| **TD-83** | **Verify `CI Summary` is in main branch protection** | Pre-flight couldn't read protection config (no PAT in shell). Manually verify via GitHub UI: Settings → Branches → main → required checks includes `CI Summary` (per TD-30). If missing, add via API. | 0.25 hr (🧑 may need owner perms) |

### Not opened — confirmed clean

- ✅ Env-var documentation: 31 vars in `.env.example`, all cross-referenced in `THIRD_PARTY_SETUP.md`. Zero undocumented refs.
- ✅ Inngest function registry: 14 files, 14 registered. No orphans.
- ✅ All 11 Inngest functions now have test coverage (TD-28 closed `messagingPush` + `educationTipRefresh`).
- ✅ Backlog freshness: A11Y/UX rows touched today — not stale (separate issue: those rows are stale because they're already shipped, not because they were forgotten).

### Outstanding — Codex re-run needed

The Codex adversarial audit was supposed to surface: silent-failure patterns, RLS-bypass via `supabaseAdmin` outside server/api, missing CSRF/rate-limit on mutating REST routes, migration-safety regressions. **Re-run before opening LAUNCH-001 (App Store TestFlight) PR** — `/codex:rescue` with the same prompt as Wave 5. Tracked as **TD-84**.

| ID | Story | Why | Size |
|---|---|---|---|
| **TD-84** | **Re-run Codex adversarial audit on apps/web/server + supabase/migrations + apps/web/inngest** | Wave 5 dispatch produced no output file. Need findings before LAUNCH-001 fires. | 0.5 hr (orchestration only; result becomes a new TD-* batch) |

---

## Proposed Waves 6–10

Real Ready queue after this discovery + sync:
- **Critical:** TD-76 (types regen)
- **HIGH test gaps:** TD-77, 78, 79, 80
- **Medium:** TD-81, 82, 83
- **Outstanding:** TD-84 (Codex re-run)
- **From original plan:** UX-035 (BriefHero mock gate), LAUNCH-004 (observability runbook)

### Wave 6 — Backlog reconciliation + critical types regen

**Workflow:** Direct Opus, single PR.
1. Run `/backlog-sync` — promotes A11Y-012..017 + UX-025..036 (minus 035) + TD-73/74/75 + LAUNCH-002/003 from Ready → Shipped in §7. Rewrites §0 counts.
2. Same PR adds the 9 new TD-76..84 rows (rows + status board only — no code).
3. Separate small PR: TD-76 types regen + verification.

### Wave 7 — Tier 1 test gap fill (parallel TDD dispatch, 4 PRs)

**Stories:** TD-77, TD-78, TD-79, TD-80
**Workflow:** `/wave 7` with `§3c TDD dispatch`. These are *test-writing* stories — ideal TDD shape (spec author writes failing tests; implementers verify they fail for the right reason; reviewer + Codex gate).

Disjoint files:
- TD-77: `apps/web/server/repositories/__tests__/identityRepository.test.ts`
- TD-78: `apps/web/server/routers/__tests__/user.test.ts`
- TD-79: `apps/web/server/repositories/__tests__/careEventsRepository.test.ts`
- TD-80: `apps/web/lib/__tests__/stripe.test.ts`

**Model routing:**
- Spec author: **Sonnet** (one subagent, sequential — must read each repo to write meaningful failing tests)
- Implementers: **N/A — these stories ARE the tests**. Skip the implementer phase. Reviewer phase still runs against the merged spec branches.
- Codex gate: run on the integration branch before queueing.

### Wave 8 — Medium close-outs + UX-035

**Stories:** TD-81, TD-82, UX-035
**Workflow:** `/dispatch` with 3 worktrees, **Sonnet × 3** (each disjoint).
- TD-81: `organizationsRepository.test.ts` — same pattern as Wave 7
- TD-82: `supabase/tests/care_events_client_id.test.sql` (or docstring in `care_events_rls.test.sql`)
- UX-035: BriefHero gate — needs judgment call on feature flag vs skeleton; subagent should propose in PR description, not pick blindly

### Wave 9 — LAUNCH-004 observability runbook

**Story:** LAUNCH-004
**Workflow:** Direct Opus. Doc consolidation needs full project context (skills, runbooks, hooks). Cross-link from THIRD_PARTY_SETUP.md and Inngest function headers.

### Wave 10 — Codex re-audit + new wave planning

**Stories:** TD-83 (🧑 GH branch protection check) + TD-84 (Codex re-run)
1. Ask user to verify branch protection in GH UI.
2. Re-dispatch Codex audit with same prompt + write output to `.codex-runs/wave5-retry-<ts>.md` (within Codex's allowed write scope).
3. Synthesize new TD-* batch from results.
4. Plan Waves 11+ from the new findings.

---

## Hard rules (unchanged from NEXT_5_WAVES.md)

- Feature/fix PRs **DO NOT** touch BACKLOG.md. Backlog edits go in dedicated `chore(backlog): …` PRs.
- Every dispatch passes the standard scope contract.
- `gh pr edit <num> --add-label queue` after open; +15 min wakeup.
- Local green before `gh pr ready`.
