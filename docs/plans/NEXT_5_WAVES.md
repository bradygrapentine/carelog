# Next 5 Development Waves — 2026-04-27

> **⚠ Deprecated merge-policy mention:** This document was written when the repo used Mergify and a `queue` label. As of 2026-05-10, Mergify is no longer in use; the canonical merge flow is `gh pr merge --auto --squash` via GitHub native auto-merge. References to Mergify / `--add-label queue` below are kept as historical record. See `.claude/CLAUDE.md` §Merge Policy.


Generated after PRs #224/225/226/227 merged. Backlog §0 status board is stale (run `/backlog-sync` first to clean it).

## Pre-flight (run before Wave 1)

1. `/backlog-sync` — promote LAUNCH-002, LAUNCH-003, TD-73/74/75 from Ready → Shipped (§7); fix §0 counts.
2. `git fetch origin && git log origin/main --oneline -5` — confirm base.
3. `pnpm test && cd apps/web && npx tsc --noEmit` — confirm clean baseline.

## Real Ready queue (post-sync)

- **A11Y-012..017** — 6 small button-type / aria-label fixes
- **UX-025..036** — 12 token-drift cleanups
- **LAUNCH-004** — observability hardening doc (TD-73/74/75 already shipped)
- **TD-03** — Sentry source maps (🧑 needs `SENTRY_AUTH_TOKEN` in Vercel)
- **PP-009** — Android visual QA (needs emulator runtime)

---

## Wave 1 — A11Y mechanical sweep (1 PR, ~30 min)

**Stories:** A11Y-012, 013, 014, 015, 016, 017
**Why bundle:** all are 1-3 line edits to add `type="button"` or contextual `aria-label`. Six PRs would be more rebase tax than the work itself.
**Workflow:** Direct Opus, single PR. Optionally hand off to **Haiku via Task tool** if Opus is doing parallel work — but each fix is so trivial that direct edit is faster than the dispatch overhead.
**Don't:** dispatch /ollama for this. The fixes need precise selector context (e.g., A11Y-013 needs `member.display_name ?? member.email` lookup) and are easier to land in one keystroke than to brief a subagent on.
**Verification:** vitest related-test hook runs automatically on each edit. Manually keyboard-walk Journal + TeamAdmin in `/live-test` before merge.

## Wave 2 — Token-drift sweep, Part A (parallel /dispatch, 6 PRs)

**Stories:** UX-025, UX-026, UX-027, UX-028, UX-029, UX-030
**Why parallel:** each touches a disjoint component file (JournalEntryForm vs TeamAdminClient vs QuickLogFab vs RoleBadge vs ExpensePanel/DocumentVault vs MedicationPanel). Zero overlap — perfect /dispatch fan-out.
**Workflow:** `/dispatch` with 6 worktrees, **Sonnet per task** (multi-file judgment for shared-token extraction in UX-025/UX-029).
**Scope contract per subagent:**
- Files allowed: only the components named in the story + `apps/web/app/globals.css` (token additions only).
- Branch: `fix/ux-NNN-<slug>`
- DO NOT: refactor surrounding code; touch BACKLOG.md; add new tests beyond the changed render assertions.
**Coordinator action:** UX-026 + UX-031 both add new tokens to `globals.css` — apply Wave 2 PRs first, let Wave 3 rebase.
**Merge:** `gh pr edit <num> --add-label queue` per PR; Mergify batches them. Wakeup at +20 min.

## Wave 3 — Token-drift sweep, Part B (parallel /dispatch, 6 PRs)

**Stories:** UX-031, UX-032, UX-033, UX-034, UX-035, UX-036
**Workflow:** identical to Wave 2 (Sonnet × 6 via `/dispatch`). UX-035 (gate BriefHero mock content) is the only judgment call — it should propose the gating mechanism (feature flag vs. skeleton) in the PR description rather than guess.
**Codex pass:** before queueing UX-036 (dark-mode token overrides — easy place to break light-mode), run `/codex:rescue` for an adversarial diff review on that one PR. Other 5 are mechanical enough to skip.

## Wave 4 — LAUNCH-004 observability hardening (1 PR + 1 doc PR)

**Story:** LAUNCH-004 (umbrella — TD-73/74/75 already done; TD-03 remains 🧑)
**Workflow:** Direct Opus.
- Write `docs/project-info/runbooks/OBSERVABILITY_CHECKLIST.md` documenting: Sentry source-map setup, rate-limit alert thresholds (TD-73), digest delivery alert query (TD-74), E2E green-streak gate behavior (TD-75), and the runbook for the on-call response to each.
- Cross-link from `THIRD_PARTY_SETUP.md` and from each Inngest function header comment.
- Open a separate `chore(backlog): …` PR to mark LAUNCH-004 shipped + add follow-up rows for any gap discovered while writing the doc.
**Why direct:** doc consolidation needs full project context (skills, runbooks, hooks); not a dispatch candidate.

## Wave 5 — Discovery + new test/TD stories

**Goal:** the agentic Ready queue runs dry after Waves 1–4; this wave refills it.

1. **Run `/test-gaps`** (read-only) → produces a ranked report of source files with no/low test coverage. Target: 5 highest-risk gaps (auth, billing, RLS-adjacent server code).
2. **Run `/codex:rescue`** with prompt "audit the current main for silent-failure patterns, dead code, and tech debt in apps/web/server/ and supabase/" — Codex adversarial pass produces a triage list.
3. **Run `/pre-flight`** to surface env / config / migration drift since launch readiness wave.
4. **Synthesize into a `chore(backlog): …` PR** that adds:
   - 5 new TD-* stories (test gaps from step 1)
   - 2-3 new TD-* stories (from Codex findings)
   - Any new LAUNCH-* or A11Y-* rows discovered
5. **Sequence the new Ready rows for Waves 6+** in this same plan file.

**Workflow split:**
- /test-gaps + /pre-flight + Codex audit run in **parallel** (3 independent reads, no shared state).
- Synthesis (writing new BACKLOG rows) is **Opus direct** — needs judgment on prefixes, sizing, and dedupe against §7 shipped log.

---

## Model routing summary

| Wave | Primary model | Why |
|---|---|---|
| 1 | Opus direct (or Haiku Task) | 6 trivial edits — dispatch overhead > work |
| 2 | Sonnet × 6 via `/dispatch` | Disjoint files, moderate judgment per token replacement |
| 3 | Sonnet × 6 via `/dispatch` + Codex on UX-036 | Same as Wave 2 + adversarial pass on dark-mode risk |
| 4 | Opus direct | Doc consolidation needs full project context |
| 5 | Parallel reads (test-gaps + pre-flight + Codex), then Opus synthesis | Independent fan-out, judgment-heavy synthesis |

## Hard rules each wave must honor

- Feature/fix PRs **DO NOT** touch BACKLOG.md (CLAUDE.md rule). Story status flips happen only in dedicated `chore(backlog): …` PRs or via `/backlog-sync`.
- Every dispatch passes the standard scope contract (files, branch, DO NOT, PHI rule, VERIFY).
- After each PR opens: `gh pr edit <num> --add-label queue` then schedule a wakeup at +15 min.
- Local green (`pnpm test && pnpm typecheck && pnpm lint`) before any `gh pr ready`.
