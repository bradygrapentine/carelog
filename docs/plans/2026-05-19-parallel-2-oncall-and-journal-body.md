# Parallel Sprint Plan — on-call shift type + journal-body consolidation (2 tracks)

**Date:** 2026-05-19
**Base SHA:** `782c7b521c812dec7aaafdb9334f1adb8d6e6847`
**Tracks:** 2 (track assignment decoupled — any session executes any unclaimed track via `/sprint --session <alias> --track <name> <this-plan-file>`)
**Close:** Any session calls `/parallel-sprint-close docs/plans/2026-05-19-parallel-2-oncall-and-journal-body.md` after both tracks have written outcome.json sidecars.

## Theme

Two file-disjoint, M-balanced backlog items: ON-78 advances the Phase 7 on-call epic (additive `shift_type` enum), TD-141 clears a recurring `/oop` finding (three divergent journal-body policies). One is SQL-migration + shift UI; the other is journal-body TS libs. Zero shared source/test/schema file.

## Disjoint-ness verified

| Track | Owned files |
|---|---|
| A (ON-78) | `supabase/migrations/<new-ts>_shift_type.sql`, `supabase/tests/shift_type*.sql`, `apps/web/lib/database.types.ts` (regen), `apps/web/app/(app)/journal/[recipientId]/ShiftForm.tsx` (+ its `__tests__/ShiftForm.test.tsx`) |
| B (TD-141) | `apps/web/lib/careEvent.ts`, `apps/web/lib/pickJournalBody.ts` (+ `apps/web/lib/__tests__/pickJournalBody.test.ts`), `apps/web/lib/handoffSummary.ts`, `apps/web/components/VisitSummary.tsx` (+ any colocated test) |

- Track A ∩ Track B = ∅ ✅ (verified: ShiftForm imports none of careEvent/pickJournalBody/handoffSummary/VisitSummary; the TD-141 libs import no shift/database.types symbol)
- Shared finalizer-only files: `BACKLOG.md` (§0 status board), `CONTEXT.md` (additive only). Tracks A/B MUST NOT touch these.
- Forbidden-shared check: none found. **`apps/web/lib/database.types.ts` is owned by Track A only** — Track B must not regenerate or edit it.

## Effort balance (§3.5)

| Track | Bucket | Rationale |
|---|---|---|
| A (ON-78) | **M** (~half day) | 1 migration + enum + DEFAULT backfill + types regen + 1 web form selector + pgTAP no-widen assertion |
| B (TD-141) | **M** (~1–2h) | 4-file typed refactor routing all body reads through one policy + test updates |

M↔M, balanced ✅.

## Executor contract (applies to both tracks)

1. **`cd <worktree>`** at session start; never operate from repo root.
2. **`git branch --show-current`** before every commit; abort on mismatch.
3. **Stage explicit file lists** (`git add <files>`) — never `git add .` / `git commit -a`.
4. **Pre-granted Bash:** `gh pr create`, `gh pr merge --auto --squash`, `gh pr view`, `gh pr checks`, `git push -u origin <branch>`, `pnpm`, `npx`, `cd`, `grep`, `cat`, `ls`, `supabase`.
5. **Heartbeat:** append a timestamp every ~5 min to `.claude/agent-status/<id>.log`.
6. **PR body:** list files changed + intentionally-NOT-changed.
7. **node_modules** is symlinked (root + `apps/web`); vitest resolves without reinstall. If a run fails on resolution, confirm env-pre-existing with changes stashed before any `--no-verify` (documented pnpm+worktree gotcha).
8. **PHI rule:** never pass email/name/phone/PII to `posthog.*` or `Sentry.*`.
9. **Migrations (Track A only):** run `pnpm migration-check` before opening the PR; `supabase test db` must pass for the new pgTAP. Regenerate types with `npx supabase gen types typescript --local 2>/dev/null > apps/web/lib/database.types.ts` (the `2>/dev/null` is load-bearing — omitting it prepends Docker logs and breaks TS).
10. **Code style:** no TS `enum` — string-literal unions only. The PG `shift_type` enum is a DB-side enum (fine); the TS mirror is `"standard" | "on_call"`.

## Worktrees (pre-created)

- Track A: `worktrees/on-78-oncall-shift-type/` (branch `feat/on-78-oncall-shift-type`)
- Track B: `worktrees/td-141-journal-body/` (branch `feat/td-141-journal-body`)

Both branch from base SHA `782c7b5`. node_modules symlinked at root + `apps/web`.

## Track A — ON-78 — On-call shift type (`shift_type` enum on `shifts`)

**Worktree:** `worktrees/on-78-oncall-shift-type/`
**Branch:** `feat/on-78-oncall-shift-type`

**Files allowed:**
- `supabase/migrations/<new-ts>_shift_type.sql` (new)
- `supabase/tests/shift_type*.sql` (new pgTAP) — or extend an existing shifts pgTAP file if one is the natural home (executor's call; must not collide with Track B — Track B touches no `supabase/**`)
- `apps/web/lib/database.types.ts` (regen only)
- `apps/web/app/(app)/journal/[recipientId]/ShiftForm.tsx` (+ `__tests__/ShiftForm.test.tsx`)

**Files out of scope — DO NOT TOUCH:**
- All Track B files (`apps/web/lib/careEvent.ts`, `pickJournalBody.ts`, `handoffSummary.ts`, `apps/web/components/VisitSummary.tsx`)
- Mobile shift-create UI (`apps/mobile/**`) — the mobile `shift_type` selector is a deliberate thin follow-up row, NOT this track (keeps the worktree off the RN build).
- `BACKLOG.md`, `CONTEXT.md` (finalizer-only)
- All other application code

**Implementation steps:**
1. New migration — **timestamp must sort after the current latest `20260518090000`** (use a `2026051911xxxx`-style ts or later; `ls supabase/migrations/ | tail -3` to confirm the floor before naming the file, to avoid out-of-order application). `CREATE TYPE shift_type AS ENUM ('standard', 'on_call');` then `ALTER TABLE shifts ADD COLUMN shift_type shift_type NOT NULL DEFAULT 'standard';`. The DEFAULT backfills existing rows — no separate UPDATE needed. RLS unchanged (column inherits `shifts` policies).
2. Regenerate `apps/web/lib/database.types.ts` (command in contract §9).
3. pgTAP: assert (a) the column exists with the enum type + NOT NULL + default `'standard'`, and (b) the new column does NOT widen access — an existing cross-org / non-member SELECT on `shifts` still returns 0 rows after the column add (pin the no-widen invariant). Bump `SELECT plan(N)` to match the added assertions.
4. `ShiftForm.tsx`: add a shift-type selector (`standard` / `on_call`) wired into the create payload. Follow `.claude/rules/ui-standards.md` (labelled control, focus ring, tokens — no raw hex). Default selection = `standard`. Update `ShiftForm.test.tsx` to cover the new field (default value + on_call selection in the submitted payload).

**Acceptance (verifiable):**
- `grep -rn "CREATE TYPE shift_type" supabase/migrations/` returns 1 match; `grep -rn "ADD COLUMN shift_type" supabase/migrations/` returns 1 match.
- `grep -n "shift_type" apps/web/lib/database.types.ts` returns ≥1 (types regenerated).
- `grep -n "shift_type\|on_call\|on-call" "apps/web/app/(app)/journal/[recipientId]/ShiftForm.tsx"` returns ≥1 (selector wired).
- `pnpm migration-check` clean; `supabase test db` green (incl. the no-widen assertion).
- `cd apps/web && npx vitest run "app/(app)/journal/[recipientId]"` green; full suite green; CI green.

**Risks + mitigations:** Forgetting to bump pgTAP `plan(N)` after adding assertions → CI RLS red (past incident c9102b5). Count assertions explicitly before committing. Types regen with Docker-log contamination → always use the `2>/dev/null` redirect.

## Track B — TD-141 — Consolidate JournalPayload `text`/`note`/`notes` → one body policy

**Worktree:** `worktrees/td-141-journal-body/`
**Branch:** `feat/td-141-journal-body`

**Files allowed:**
- `apps/web/lib/careEvent.ts` (the `JournalPayload` type, ~lines 49-54)
- `apps/web/lib/pickJournalBody.ts` (+ `apps/web/lib/__tests__/pickJournalBody.test.ts`)
- `apps/web/lib/handoffSummary.ts` (the `text`-only read at ~line 148)
- `apps/web/components/VisitSummary.tsx` (the `note ?? notes` read at ~lines 395-397)

**Files out of scope — DO NOT TOUCH:**
- All Track A files; `supabase/**`; `apps/web/lib/database.types.ts`
- `BACKLOG.md`, `CONTEXT.md` (finalizer-only)
- All other application code

**Implementation steps (line numbers VERIFIED against base SHA — re-derive if stale):**
1. Read `pickJournalBody.ts` — its param is `Record<string, unknown> | null` and it already encodes the canonical precedence (`text > note > notes`). Make it THE single body-resolution policy. **Type boundary:** pass each call site's payload straight through. `VisitSummary` already treats payload as `Record<string,unknown>` (via `stringField`), so it's directly compatible. `handoffSummary`'s `je.payload` is the typed `JournalPayload` — pass it as-is (a typed object is assignable to `Record<string,unknown>`); if TS complains at the boundary, widen `pickJournalBody`'s param or cast AT THE CALL SITE — do **NOT** loosen `JournalPayload`'s own field typing in `careEvent.ts` to fit.
2. **Three body-read sites must route through `pickJournalBody` (all confirmed on main):**
   - `handoffSummary.ts:148` — `je?.payload.text ? je.payload.text.slice(0,120) : "(no text)"`
   - `handoffSummary.ts:192-193` — `isJournalEvent(e) && e.payload.text ? e.payload.text.slice(0,120) : …` (the SECOND, easily-missed site)
   - `VisitSummary.tsx:396-397` — `stringField(e.payload, "note") ?? stringField(e.payload, "notes")`
   Replace each hand-rolled pick with `pickJournalBody(payload)`. The divergence (handoff ignoring `note`/`notes`; VisitSummary ignoring `text`) is the bug being fixed — both adopt the unified precedence. **Do NOT touch `VisitSummary.tsx:369` `r.notes ?? null`** — that's an unrelated *vitals* row, not journal body, and is out of scope.
3. `careEvent.ts` `JournalPayload`: keep the three optional slots readable for back-compat with already-persisted payloads (do NOT drop fields — there is no data migration in this track), but document that `pickJournalBody` is the only sanctioned reader. If a single `body` getter helps, add it in `pickJournalBody.ts` (not a stored field). The doc-comment's embedded line refs (`VisitSummary.tsx:387-390`, `handoffSummary.ts:146`) are stale — update or drop them, don't trust them.
4. Update `pickJournalBody.test.ts` to pin the precedence + add cases proving handoff and VisitSummary now agree on the same body for `{text, note, notes}` permutations.

**Acceptance (verifiable — each FAILS on current main, PASSES after):**
- `grep -n 'stringField(e.payload, "note")' apps/web/components/VisitSummary.tsx` returns NO matches (the ad-hoc `note ?? notes` journal pick is gone — routed through `pickJournalBody`). The `r.notes ?? null` vitals line at :369 is untouched and out of scope.
- `grep -cE "payload\.text\b" apps/web/lib/handoffSummary.ts` returns 0 (BOTH the :148 and :192-193 hand-rolled `payload.text` picks removed). On main this is 3 — a positive fail-before signal.
- `grep -c "pickJournalBody" apps/web/lib/handoffSummary.ts` ≥1 AND `grep -c "pickJournalBody" apps/web/components/VisitSummary.tsx` ≥1 (positive: both adopted the helper — a deleted file would fail this).
- `cd apps/web && npx vitest run lib/__tests__/pickJournalBody handoffSummary VisitSummary` green; full suite green; CI green.

**Risks + mitigations:** Missing the second handoff site (:192-193) → grep `payload\.text` count stays >0; the count-based acceptance catches it. Changing handoff/VisitSummary body source could shift output for payloads that set multiple slots → the precedence test pins the new canonical behavior; treat any snapshot diff as intended (document in PR). No DB migration — persisted payloads keep all three slots; only the read policy unifies.

## Merge order

Independent — either order. No soft-deps (no shared file; no cross-import).

## Execution gate

`/opus-on-opus docs/plans/2026-05-19-parallel-2-oncall-and-journal-body.md --from-sprint` runs at plan authoring (below). Apply must-fix before executors start.

## Close protocol

When both tracks have written `.claude/state/sessions/<alias>/outcome.json` (status: complete), any session in repo root:

```
/parallel-sprint-close docs/plans/2026-05-19-parallel-2-oncall-and-journal-body.md
```

The close skill does the single targeted BACKLOG.md tail-edit (flip ON-78 + TD-141 → §7 Shipped, recount §0) + claims.json + INDEX.md cleanup. NOT a full `/backlog-sync` (the pre-plan sync already ran). Per-track session dirs deleted last.
