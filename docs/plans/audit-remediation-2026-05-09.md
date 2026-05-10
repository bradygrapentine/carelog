# Plan — Address `2026-05-09-roadmap-and-harness-audit.md`

> **⚠ Deprecated merge-policy mention:** This document was written when the repo used Mergify and a `queue` label. As of 2026-05-10, Mergify is no longer in use; the canonical merge flow is `gh pr merge --auto --squash` via GitHub native auto-merge. References to Mergify / `--add-label queue` below are kept as historical record. See `.claude/CLAUDE.md` §Merge Policy.


Source: `docs/audits/2026-05-09-roadmap-and-harness-audit.md`. Four execution waves, ordered by ROI per hour. Total estimated effort: **~7–9 hr active work** (revised after peer review on 2026-05-09; D.5 is investigation-only and not counted).

Revised after Opus peer review on 2026-05-09. Key revisions: D.2 hoisted into Wave A; C.3 budget lifted from 1.5 → 3–4 hr with diff-triage; C.4 made line-for-line move with stub pointers; missing audit findings (§C Outer-circle, copy-audit.md, codex-adversarial-gate) added; verification steps tightened.

## Guiding decisions (decide once, applies everywhere)

1. **Backlog edits ship in dedicated `chore(backlog): …` PRs.** Project rule: feature/fix PRs do NOT touch `BACKLOG.md`.
2. **One audit-finding per PR** unless two findings touch overlapping files (then bundle).
3. **No autopilot dispatches** for any of this work. Direct implementation only — every fix is a low-LOC config/markdown change where dispatch overhead exceeds the fix cost.
4. **Each PR ships behind the existing `queue` Mergify label flow.** No `--auto --squash`.
5. **No deletes for skill dedup** until the project copy and global copy are diff'd and the better content lives in global. Diff first, merge content, then delete.

---

## Wave A — Stop the bleeding (~50 min total)

Highest-ROI items in the audit: restore broken regression nets, fix the worktree-commit guard that's actively blocking parallel work, unblock honest backlog reading. Ship serially in four PRs (independent files; bundling would muddy revert granularity).

### A.1 Fix 9 stale-path hooks in `.claude/settings.json` (~10 min)

**The problem.** `.claude/settings.json` references `/Users/bradygrapentine/Documents/projects/carelog` in 9 places. The repo lives at `/Users/bradygrapentine/projects/carelog` (no `Documents/`). The pgTAP-on-RLS-edit and mobile-typecheck-on-edit hooks have been silently no-op'd; failures swallowed by trailing `|| true`.

**The fix.** Single global search/replace:

```sh
sed -i '' 's|/Users/bradygrapentine/Documents/projects/carelog|/Users/bradygrapentine/projects/carelog|g' .claude/settings.json
```

**Verification (3 checks — must all pass).**
1. `grep -rn "Documents/projects/carelog" .claude/` returns 0 lines (catches all 9 references including the 6 permission allowlist entries the functional smoke tests can't hit).
2. Edit a `supabase/tests/*.test.sql` file → confirm the pgTAP hook actually runs `supabase test db` and prints output.
3. Edit an `apps/mobile/*.ts` file → confirm mobile tsc fires.

**PR title.** `chore(harness): fix 9 stale Documents/projects/carelog hook paths`.

### A.2 Main-branch commit guard: use worktree cwd, not harness-root (~20 min)

**Hoisted into Wave A from D.2 per peer review** — this is the highest-impact gotcha for current parallel-dispatch work, and small enough to bundle with the bleed-stop wave.

**The problem.** The PreToolUse `git commit` guard runs `git branch --show-current` in the harness root, not the worktree. If the harness root is on `main`, the hook hard-blocks every worktree commit even when the worktree itself is on a feature branch.

**The fix.** In `.claude/settings.json`, replace:

```sh
branch=$(git branch --show-current 2>/dev/null)
```

with:

```sh
# Use the worktree of the git command being run, not the harness cwd.
cwd=$(python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('cwd','.'))" 2>/dev/null || echo .)
branch=$(git -C "$cwd" branch --show-current 2>/dev/null)
```

**Verification.** From a worktree on a feature branch, with the harness root deliberately on `main`, `git commit` succeeds.

**PR title.** `chore(harness): main-branch commit guard uses worktree cwd`.

### A.3 Backlog/roadmap stale-reference sweep (~20 min)

**The problem.** `/carezone-alternative` was folded into `/about` (PRs #316/#317) but multiple documents still reference the standalone page. ROADMAP says "Weekly digest (not started)" but it shipped (ON-50, ON-59). ROADMAP Phase 3 lists "Outer circle volunteer board" without status (audit §C — added per peer review).

**The fix.** Single chore PR touching:
- `BACKLOG.md` row ON-53: append `(consolidated into /about 2026-04 via #316/#317)`.
- `BACKLOG.md` row SEO-004: replace `/carezone-alternative` with `/about#compare`.
- `BACKLOG.md` row ON-56: tighten `/data-commitment (or /trust)` → just `/trust` (audit §D, originally B.4 — folded in here since it's a one-line edit on the same file).
- `docs/plans/post-wave-9-execution.md` line 137: drop the `(marketing)/carezone-alternative/page.tsx` target from SEO-003.
- `docs/project-info/product/ROADMAP.md` Phase 1 §"Weekly digest": change `(not started)` to `(shipped — see ON-50/ON-59 + LAUNCH-004 / TD-74)`.
- `docs/project-info/product/ROADMAP.md` Phase 3 §"Outer circle volunteer board": append `(shipped — see /care/[shareToken] outer-circle flow)` with a link to the relevant `OuterCirclePanel.tsx` shipped row.
- `docs/project-info/product/ROADMAP.md` Phase 6 SEO §: change `the CareZone-comparison page` to `the CareZone comparison section on /about`.
- `apps/web/copy-audit.md` lines 405 and 427: strike both findings (referenced `(marketing)/compare/page.tsx` which no longer exists). Add a one-line note pointing audit consumers at `/about` for re-audit if needed.

**Verification.** `grep -rn "carezone-alternative\|(marketing)/compare" BACKLOG.md docs/ apps/web/copy-audit.md` returns no live references (matches in `apps/web/node_modules/**` and the §7 shipped-log historical row are expected).

**PR title.** `chore(docs): backlog/roadmap/copy-audit stale-reference sweep`.

### A.4 Strike duplicate / superseded backlog rows (~10 min)

**The problem.** ON-55 and ON-69 are both 🧊 Deferred "Visit recorder · Phase 7" with identical scope. UX-066 was filed first; UX-103/104/105 split it into 3 implementable rows on 2026-05-01 — UX-066 still says 🟢 Ready.

**The fix.**
- Strike ON-69 (keep ON-55 — lower ID).
- Mark UX-066 as `🧊 Deferred · superseded by UX-103/104/105`.

**PR title.** `chore(backlog): strike ON-69 duplicate; mark UX-066 superseded`.

---

## Wave B — Backlog honesty (~1 hr total)

After Wave A, the docs match reality. Wave B closes gaps the audit surfaced where reality and BACKLOG diverge in less-obvious ways.

### B.1 Verify-and-resolve four likely-stale Ready rows (~45 min)

**The problem.** UX-035, UX-053, SEO-006, TD-87 are 🟢 Ready but each shows signs of being mis-scoped or already-done.

**The fix.** Per row, audit-then-update:

| Row | Audit step | Likely outcome |
|---|---|---|
| UX-035 (BriefHero mock) | Read `apps/web/components/brief/BriefHero.tsx` — does it still render hardcoded mock content + a `TODO(UX-24+)` comment? | If `BriefSection` and `dashboardSummary` already feed BriefHero with real data → strike row. If still mocked → keep but link to UX-24 work. |
| UX-053 (empty-state pass) | Sample `MedCard.tsx:154`, `OuterCirclePanel.tsx`, `JournalTimeline.tsx` empty states for primary-action affordances. | Probably partial. Either narrow the row to remaining sites or strike. |
| SEO-006 (cornerstone content engine) | Confirm the 8hr scope is mostly long-form copy writing. | Move to 🧑 Needs human (you're the writer). |
| TD-87 (Lighthouse a11y gating) | Re-read row — three forking solution paths, no chosen one. | Convert to 🟡 Spike or commit to one path in the row text. |

**PR title.** `chore(backlog): resolve UX-035 / UX-053 / SEO-006 / TD-87 status drift`.

### B.2 File missing rows for ROADMAP-promised features (~15 min)

**The problem.** ROADMAP promises features that have **no Ready row** anywhere — Coverage request board (`coverage_windows`), Refill alerts Inngest job, Prescription label scanning OCR, Burnout tracker, Full history export. Risk: these silently slip out of scope.

**The fix.** File 5 new Ready rows under appropriate prefixes:

| ID (proposed) | Status | Title | Notes |
|---|---|---|---|
| ON-70 | 🟢 Ready | Coverage request board (`coverage_windows` table + claim flow + gap detector) | Per ROADMAP Phase 2. ~5 days. **Schema work.** |
| ON-71 | 🟢 Ready | Refill alerts Inngest job (`supply_days_remaining ≤ 7` nightly) | Per ROADMAP Phase 3. ~2 days. |
| ON-72 | 🧊 Deferred | Prescription label scanning OCR pipeline | Per ROADMAP Phase 3. Dependency: stable medication catalog (Phase 3 prereq). Defer until that lands. |
| ON-73 | 🧊 Deferred | Burnout tracker | Per ROADMAP Phase 4. Explicit "needs 2-3 mo of data" rationale in roadmap. |
| ON-74 | 🟢 Ready | Full history export (PDF / structured) | Per ROADMAP Phase 4. ~3 days. |

**PR title.** `chore(backlog): file 5 missing ROADMAP-promised rows (ON-70..74)`.

### B.3 Memory hygiene (~5 min)

**The problem.** `project_caresync_2_0_design.md` says "Sage as additional theme (violet stays default)" — contradicted by later `project_caresync_handoff_session.md` ("Sage now default"). `session_2026-04-17-dispatch.md` is an ephemeral session log that violates the "What NOT to save in memory" rule.

**The fix.**
- Delete `~/.claude/projects/-Users-bradygrapentine-projects-carelog/memory/project_caresync_2_0_design.md` and remove its `MEMORY.md` line.
- Delete `~/.claude/projects/-Users-bradygrapentine-projects-carelog/memory/session_2026-04-17-dispatch.md` and remove its `MEMORY.md` line.

**Verification.** Read MEMORY.md — only 13 entries; both removed.

**No PR.** Memory lives outside the repo.

### B.4 (folded into A.3 per peer review)

Original B.4 ("ON-56 path tightening") merged into A.3's stale-reference sweep — same file, single-line edit, no reason to ship separately.

---

## Wave C — Harness reduction (~4–5 hr total, revised)

After Waves A+B, docs are honest and broken hooks are fixed. Wave C tackles the structural issues: skill duplication, hook scoping, and CLAUDE.md bloat. These are higher-effort, lower-urgency. Worth doing because the steady-state context overhead and the "scar-tissue" gotchas list compound across every session.

### C.1 Hook scope-down (~30 min)

**The problem.** PostToolUse Edit hooks in `.claude/settings.json` run a full `apps/web` typecheck and lint on every edit, even when the edit is to a `supabase/`-only file.

**The fix.** Add a `python3` filter to each hook that exits 0 (skip) if the edited file isn't under `apps/web/`:

```json
{
  "type": "command",
  "command": "python3 -c \"import sys,json; d=json.load(sys.stdin); fp=d.get('tool_input',{}).get('file_path',''); exit(0 if fp.startswith('apps/web') or '/apps/web/' in fp else 1)\" 2>/dev/null && cd apps/web && output=$(npx tsc --noEmit 2>&1); if [ -n \"$output\" ]; then echo \"[tsc] $output\" | head -20; fi"
}
```

(Same shape for the eslint hook.)

**Verification.** Edit a `supabase/migrations/*.sql` file — neither tsc nor eslint runs. Edit a `apps/web/lib/foo.ts` file — both run.

**PR title.** `chore(harness): scope tsc + eslint hooks to apps/web edits only`.

### C.2 Settings allowlist cleanup (~15 min)

**The problem.** ~26 entries in `permissions.allow`, including duplicates (`Bash(echo "EXIT:$?")`, `Bash(echo "VITEST_EXIT:$?")`, `Bash(echo "GIT_EXIT:$?")`), one-off ad-hoc grep commands, and 6 stale-path entries already covered in A.1.

**The fix.**
- Collapse the three `Bash(echo "X_EXIT:$?")` entries into a single `Bash(echo:*)`.
- Strike the one-off `Bash(grep -n "color-brand…" /Users/bradygrapentine/Documents/projects/carelog/apps/web/app/journal/[recipientId]/TeamPanel.tsx …)` entry.
- Strike `Edit(/.claude/skills/deploy-autopilot/**)` if the deploy-autopilot skill isn't being actively edited.
- Drop the 6 stale-path entries already fixed in A.1 (the path-substitution will leave them as no-op duplicates of working entries).

**PR title.** `chore(harness): dedupe + strike one-off entries from permissions allowlist`.

### C.3 Skill dedup project ↔ global (~3–4 hr, revised)

**The problem.** 18 skill names duplicated between `~/.claude/skills/` and `~/projects/carelog/.claude/skills/`. Project copies shadow global. Drift risk; impossible to tell which actually ran.

**The fix.** Three phases. Reviewer flagged that the original `head -40` diff loop hides divergence in 200+-line skill files; replaced with two-pass triage (`--brief` first to bin, then full diff only on divergent ones).

**Phase 1 — bin into identical / divergent (~30 min):**

```sh
for skill in backlog-dispatch backlog-sync dispatch live-test ollama plan-with-tests \
             pre-flight routing-report schema-dump session-end ship-story skill-builder \
             supabase-types tdd-ship test-gaps excalidraw-diagram \
             integration-nextjs-app-router; do
  diff -q "$HOME/.claude/skills/$skill/SKILL.md" \
          "$HOME/projects/carelog/.claude/skills/$skill/SKILL.md" 2>&1
done
```

Identical-output skills go straight into the phase 3 delete list (mechanical). Divergent skills queue for phase 2.

**Phase 2 — full diff + decide on divergent skills (~1.5–2 hr):** for each divergent skill, full `diff -u` (no `head` — read the whole thing). Decide:
- **Project is more current** → copy project content into global, delete project copy.
- **Project encodes carelog-specifics that don't belong in global** → rename project copy (e.g. `tdd-ship` → `tdd-ship-carelog`) so it doesn't shadow global.
- **Both have non-overlapping good content** → manually merge into global, delete project copy.

**Phase 3 — execute deletes + promotes (~1 hr):** two PRs.
- PR-1 ("identical-shadow deletes") body MUST include the project-copy SHAs at HEAD before deletion (`git log -1 --pretty=%H -- .claude/skills/<name>/SKILL.md`) so a revert is mechanical if a global copy turns out to differ subtly. Reviewer flagged this risk explicitly.
- PR-2 ("divergent promotions / renames") similarly captures pre-change SHAs in the description.

**PR titles.** `chore(harness): skill dedup phase 1 — delete redundant project shadows`, `chore(harness): skill dedup phase 2 — promote project skills with carelog updates`.

### C.4 CLAUDE.md split (~45 min, revised — line-for-line move with stub pointers)

**The problem.** Project `.claude/CLAUDE.md` is 412 lines mixing behavioral rules (PHI, branch hygiene) with reference material (model routing, skill catalog, hook docs). ~3-4k tokens of fixed overhead each session, with the load-bearing rules buried.

**The risk** (reviewer flagged). Moving any load-bearing rule to "reference" silently disables it (the file isn't loaded automatically). Recovery is manual; there's no enforcement test.

**The fix.** Strict line-for-line move — no rewriting, no consolidating, no editing during the move. Each chunk that leaves CLAUDE.md gets a stub pointer left behind.

Procedure:
1. **Inventory pass first** (write the section list to scratch before any edit). Mark each section with `BEHAVIORAL` (must stay in CLAUDE.md) or `REFERENCE` (moves out).
2. **For each REFERENCE section**: cut it verbatim into the target file, then leave a single-line stub in CLAUDE.md: `> See [HARNESS_USAGE.md §<anchor>](path) for <topic>`. The stub itself is small, but it tells future Claude where to look.
3. **For each BEHAVIORAL section**: leave untouched. No copy-edits in this PR.

| Target file | Sections that move in | Loaded by Claude when |
|---|---|---|
| `.claude/CLAUDE.md` (~140 lines after move) | BEHAVIORAL-only: PHI rules, branch hygiene, scope contract, plan-mode trigger, deliver-artifacts rule, status-reporting honesty, review-mode read-only, things-Claude-should-NOT-do, self-improvement | Every session (auto). |
| `docs/project-info/runbooks/HARNESS_USAGE.md` (existing — append) | Hook docs, skill catalog, model-routing matrix, plugin priority, Mergify procedure, MCP setup, agent contract, ollama dispatch matrix | On demand. |
| `docs/project-info/CONVENTIONS.md` (new) | Code style (`type` over `interface`, no enums), commit format, file-organization conventions | On demand. |

**Verification (3 checks).**
1. `wc -l .claude/CLAUDE.md` returns ≤140.
2. Every BEHAVIORAL section listed above appears verbatim in the trimmed file (manual spot-check; PR description lists the exact sections retained).
3. `grep -E "PHI|posthog\.identify|posthog\.capture|main-branch|never commit directly to main" .claude/CLAUDE.md` returns at least one hit per term — guards against the silent-deletion failure mode.

**PR title.** `chore(harness): split CLAUDE.md — behavioral in CLAUDE.md, reference in HARNESS_USAGE.md (line-for-line move + stub pointers)`.

**Rollback plan.** Single revert of the move PR restores the original file. PR description includes the SHA of the pre-split CLAUDE.md.

### C.5 Pull in valuable global skills not yet in project (~20 min)

**The problem.** Audit Section I lists `verify-before-commit`, `subagent-heartbeat`, `migration-safety`, `perf-regression-gate` as global skills that would close real failure modes here. Reviewer flagged that `codex-adversarial-gate` (used today; `.codex-runs/` exists) was missed.

**The fix.** Decide per skill:
- `verify-before-commit` — rely on the global (already exists). Verify it loads on `/verify-before-commit`.
- `subagent-heartbeat` — already referenced from `/dispatch` and `/wave`. Confirm global version is what they reach.
- `migration-safety` — wraps `create-migration`. Add to project's `/create-migration` as a pre-step.
- `perf-regression-gate` — confirm wired into Wave 12 SEO-005 plan.
- `codex-adversarial-gate` — confirm `.codex-runs/` is being populated by recent `/wave` invocations. If not, the gate isn't actually firing.

**No PR yet** — this is research. Outcome may produce one or two follow-up PRs.

---

## Wave D — Scar-tissue removal (~1 hr total, revised — D.2 hoisted to A.2)

After Waves A–C, the harness is honest and the rules are crisp. Wave D fixes the remaining recurring breakages from the "Known Gotchas" list — each one is fightable scar tissue that costs real time per session. (D.2 was the highest-impact gotcha; moved into Wave A.)

### D.1 Pre-commit vitest hook: skip on yaml/markdown-only diffs (~30 min)

**The problem.** `pre-commit-vitest.sh` flakes on PRs whose diff is only `*.yml` / `*.md` (no JS/TS source could affect the test outcome). Hit twice in a single session on TD-32 per the gotchas list.

**The fix.** Add a check at the top of `.claude/hooks/pre-commit-vitest.sh`:

```sh
# Skip vitest entirely if the diff has no JS/TS source files staged.
JS_TS_STAGED=$(git diff --cached --name-only | grep -E '\.(ts|tsx|js|jsx)$' | grep -v -E '(test|spec)\.' || true)
if [ -z "$JS_TS_STAGED" ]; then
  echo "[pre-commit] no JS/TS source changes staged — skipping vitest"
  exit 0
fi
```

**Verification.** Stage only `BACKLOG.md` and run `git commit` — the hook prints "skipping vitest" and exits 0.

**PR title.** `chore(harness): pre-commit vitest skips when no JS/TS staged`.

### D.2 (hoisted to A.2 per peer review)

The main-branch commit guard fix is the highest-impact gotcha for active parallel work; moved into Wave A.

### D.3 Pre-commit ESLint pass to catch React 19 purity violations (~25 min, revised — verification added)

**The problem.** `Date.now()` / `Math.random()` inside `useMemo`/`useCallback` is a hard lint error in React 19. The pre-commit hook only runs vitest, so the failure surfaces in CI Lint, not locally.

**The fix.** Append to `.claude/hooks/pre-commit-vitest.sh` (or add a sibling `pre-commit-eslint.sh`):

```sh
# Catch React 19 purity errors locally before CI Lint flags them.
cd apps/web && npx eslint --quiet --max-warnings 0 \
  $(echo "$JS_TS_STAGED" | sed 's|^|../../|') 2>&1 | tail -20
ESLINT_EXIT=${PIPESTATUS[0]}
[ "$ESLINT_EXIT" -ne 0 ] && exit "$ESLINT_EXIT"
```

(Reuse `JS_TS_STAGED` from D.1 — implement D.1 first.)

**Verification.** Stage a file containing `useMemo(() => Date.now(), [])` (the canonical React 19 purity violation). Run `git commit`. Confirm it blocks with the expected eslint error.

**PR title.** `chore(harness): pre-commit eslint on staged JS/TS to catch React 19 purity errors`.

### D.4 Subagent context-budget guidelines + verifier (~30 min, revised — guideline not hard cap)

**The problem.** When a dispatched subagent has 4+ files to write before commit, the pre-commit vitest hook (~30–60s) inside the commit can exhaust the agent's remaining context. Agent reports "completed" while the worktree still has files staged-but-uncommitted.

**The fix.** Three soft levers (reviewer flagged a hard file-count cap as over-fitting one observed failure):
1. In `.claude/skills/dispatch/SKILL.md`, add a **guideline**: dispatches with 4+ files should brief the agent to push after the first commit (red-phase) so subsequent green-phase commits land on the open PR.
2. Add a "split-or-push?" decision question to the dispatch pre-flight: "Will this subagent need to write 4+ files? If yes, either split the dispatch into two subagents OR explicitly require an early push."
3. **Required**: post-dispatch verifier the orchestrator runs after declaring done:

```sh
gh pr list --author @me --json number,headRefName | jq '.[] | select(.headRefName == "<branch>")' | grep -q . || echo "[ALERT] subagent reported done but no PR exists for $branch"
```

This is the load-bearing piece — guidelines drift, but the verifier surfaces the failure mode every time.

**PR title.** `chore(harness): dispatch — early-push guideline + post-dispatch PR verifier`.

### D.5 Trim Agent dispatch context injection (~15 min)

**The problem.** Today's session hit `Prompt is too long` errors twice when dispatching `Explore` subagents with ~300-word prompts. The injected context (CLAUDE.md, memories, MCP server instructions, vercel knowledge updates, etc.) is what's blowing the cap.

**The fix.** Investigate what's auto-injected into Agent dispatches via the Anthropic CLI. Likely candidates:
- The full `CLAUDE.md` from project + global gets injected (so C.4 split helps here).
- All memory files get injected (so B.3 cleanup helps here).
- MCP server instructions (one block per server) get injected even if the agent doesn't use the tools.

If Agent dispatches inherit the parent session's full context, there's no quick fix beyond reducing the steady-state context (C.4 + B.3). Document the constraint in CLAUDE.md so future sessions plan dispatch sizes accordingly.

**No standalone PR.** Captured as a note appended to CLAUDE.md after C.4 split lands.

---

## Sequencing & dependencies

```
Wave A (50 min) ────────── A.1, A.2, A.3, A.4 file-disjoint, ship in any order
                            (A.2 hoisted from D.2; A.4 was A.3)
                              │
                              ▼
Wave B (1 hr)   ────────── B.1 → B.2 sequential on BACKLOG.md
                            B.3 (memory) is repo-external, parallel
                            (B.4 folded into A.3)
                              │
                              ▼
Wave C (4-5 hr) ────────── C.1, C.2 file-disjoint within .claude/settings.json — bundle
                            C.3 (skill dedup) phases sequential within itself
                            C.4 (CLAUDE.md split) must precede D.5
                            C.5 is research → may produce follow-up PRs
                              │
                              ▼
Wave D (1 hr)   ────────── D.1 → D.3 sequential (D.3 reuses D.1 var)
                            D.4 file-disjoint
                            D.5 docs append (no PR; investigation only — not in effort total)
```

Recommended single-sitting order: **A.1 → A.2 → A.3 → A.4 → C.1 → D.1 → D.3 → C.4 → B.1 → B.2 → B.3 → C.2 → C.3 → D.4 → C.5 → D.5**.

---

## Out of scope

- Rewriting any skill content beyond a copy-from-global. Skill content quality is a separate audit.
- Refactoring hooks beyond path fix + scope-down. The hooks generally work; this plan only touches the broken or expensive ones.
- Splitting global `~/.claude/CLAUDE.md` (only project CLAUDE.md is in C.4 scope). Global is 122 lines — reasonable.
- Replacing Mergify or Vercel — separate decisions.

---

## Success criteria for the whole plan

1. `grep -rn "Documents/projects/carelog" .claude` returns nothing.
2. `grep -rn "carezone-alternative\|/compare" BACKLOG.md docs/project-info/product/ROADMAP.md docs/plans/` returns no live references.
3. ROADMAP Phase 1 "Weekly digest" no longer says "(not started)".
4. `wc -l .claude/CLAUDE.md` is ≤140 lines.
5. No skill name appears in both `~/.claude/skills/` and `~/projects/carelog/.claude/skills/` unless intentionally renamed (e.g. `tdd-ship-carelog`).
6. CLAUDE.md "Known Gotchas" list is shorter by at least 4 entries (D.1, A.2 [formerly D.2], D.3, D.4 each remove one).
7. Editing a `supabase/tests/*.test.sql` file actually triggers `supabase test db` (regression net restored).
