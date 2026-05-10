# Cross-Project Claude Code Harness Audit

**Date:** 2026-05-10
**Scope:** All 24 real projects under `~/projects/` (excluding `node_modules/`, `worktrees/`, `handoff_pr_quick_merge_design/` stub, `docs/`).
**Method:** Read-only inventory of `CLAUDE.md`, `.claude/`, `scripts/`, `BACKLOG.md`, `docs/{plans,adr}/`, pre-commit hooks.
**Carelog reference state:** post-PR #422 (removal pass) — treated as merged.

---

## 1. Inventory matrix

`Y` = present, `N` = absent. Numbers = file counts. "Nested" includes the root entry.

| Project | rootCM | nested CM | skills | agents | hooks | cmds | rules | scripts | BACKLOG | plans | ADR | precommit | settings.json |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20carat | N | 0 | 0 | 0 | 0 | 0 | 0 | 0 | Y | N | N | N | N |
| auto-exit | Y | 1 | 0 | 0 | 0 | 0 | 0 | 0 | Y(nested) | Y(nested) | N | N | N |
| auto-rebaser | N | 0 | 0 | 0 | 0 | 0 | 0 | 2 | N | N | N | N | N |
| bcherny-claude | Y | 1 | 0 | **6** | 0 | **7** | 0 | 0 | N | N | N | N | Y |
| boring-apps | N | 2 | 0 | 0 | 0 | 0 | 0 | 0 | N | N | N | N | N |
| **carelog** | N* | 5 | **15** | 1 | 3 | 0 | 1 | 7 | Y | Y | N | Y | Y |
| disclosure-archive | N | 1 | 0 | 0 | 0 | 0 | 0 | 0 | Y | Y | N | N | N |
| docs | N | 0 | 0 | 0 | 0 | 0 | 0 | 0 | N | N | N | N | N |
| e2e-medicinal-mushroom | N | 0 | 0 | 0 | 0 | 0 | 0 | 0 | N | N | N | N | Y |
| env-doc-ops | Y | 1 | 0 | 0 | 0 | 0 | 0 | 1 | N | Y | Y | N | N |
| fathom | Y | 1 | 0 | 0 | 0 | 0 | 0 | 0 | Y | Y | N | N | N |
| fleet | N | 0 | 0 | 0 | 0 | 0 | 0 | 0 | N | N | N | N | N |
| flush | N | 0 | 0 | 0 | 0 | 0 | 0 | 0 | N | N | N | N | N |
| gh-pr-quick-merge | Y | 1 | 0 | 0 | 0 | 0 | 0 | 5 | Y | Y | Y | N | Y |
| handoff_pr_quick_merge_design | N | 0 | 0 | 0 | 0 | 0 | 0 | 0 | N | N | N | N | N |
| kalshi_structural_arb | N | 1 | 0 | 0 | 0 | 0 | 0 | 0 | N | N | N | N | Y |
| kalshi-edge | Y | 1 | 0 | 0 | 0 | 0 | 0 | 0 | N | N | N | N | N |
| kalshi-weatherman | N | 1 | 0 | 0 | 0 | 0 | 0 | 1 | N | N | N | N | Y |
| law-4-kids-llc | Y(stub) | 1 | 0 | 0 | 0 | 0 | 0 | 0 | N | N | N | N | N |
| lease-analyzer | Y(thin) | 3 | 0 | 0 | **2** | 0 | 0 | 2 | N | Y | N | Y | Y |
| prediction-market-terminal | Y | 1 | 0 | 0 | 0 | 0 | 0 | 1 | N | N | Y(12) | N | N |
| qm-test-fixture | N | 0 | 0 | 0 | 0 | 0 | 0 | 0 | N | N | N | N | N |
| scu | Y(thin) | 2 | 0 | 0 | 1 | 0 | 0 | 0 | Y | Y | N | N | Y |
| trading-bot | Y | 19** | 0 | 0 | 0 | 0 | 0 | 0 | N | N | Y | N | N |

\* carelog uses `.claude/CLAUDE.md` (project-instruction file) instead of root `CLAUDE.md`.
\** trading-bot's 19 nested CLAUDE.mds are per-workstream branch directory copies, not 19 distinct surfaces.

---

## 2. Carelog harness summary (post-PR #422)

Carelog runs the heaviest harness in the portfolio. Project instructions live in `.claude/CLAUDE.md` (229 lines) plus 4 nested per-surface files (`apps/web`, `apps/mobile`, `supabase`, `e2e`). One UI rules file at `.claude/rules/ui-standards.md`. One subagent (`rls-reviewer`). Three hooks: `pre-commit-vitest.sh` (related-only vitest gate), `related-test.sh` (PostToolUse on Edit/Write), `route-model-log.sh` (PreToolUse on Agent — logs routing + blocks Haiku >6k chars and Opus on mechanical work).

Fifteen project-local skills survived the PR #422 cull: `add-component, create-migration, deploy-autopilot, dispatch, expo, live-test, mobile-ui, ollama, review, schema-dump, sentry-triage, session-end, ship-story, supabase-types, tdd-ship, test-gaps`. Seven custom scripts under `scripts/` (a11y, lighthouse, live-test, mobile UI, pre-deploy, e2e streak monitor). `BACKLOG.md` is single source of truth, `docs/plans/` for waves, no ADR directory. Pre-commit gate runs scoped vitest. Heavy use of model routing via `routing.yaml` + agent-status heartbeats + wave-locks. Inherits a large global `~/.claude/` plugin pack (superpowers, context-mode, expo, vercel, impeccable, etc.).

---

## 3. Peer comparison highlights

### bcherny-claude — agents+commands school
- 6 named subagents as discrete `.md` files: `staff-reviewer, code-architect, code-simplifier, build-validator, oncall-guide, verify-app`. Each is a focused persona, not a skill.
- 7 slash commands as files: `commit-push-pr, grill, quick-commit, review-changes, techdebt, test-and-fix, worktree`.
- Zero hooks, zero skills, zero scripts. Pure prompt-engineering harness.
- 102-line CLAUDE.md — about half carelog's, much more concrete on workflow.
- What carelog doesn't have: ad-hoc `techdebt` and `grill` commands as repo-pinned files.

### lease-analyzer — minimum-viable hooks
- 15-line CLAUDE.md (just the retro trigger). All operating discipline lives in hooks + routing.yaml, not prose.
- Two hooks (`related-test.sh`, `route-model-log.sh`) — the same model-routing log carelog uses, hot-forked.
- `pr-ready-gate/last-run.log` artifact suggests a PR-ready gate that records its last run (not present in carelog).
- `wave-locks/` directory — lockfile pattern for wave dispatch concurrency. Carelog has the same dir but treats it as ephemeral.
- No skills directory at all — relies entirely on global skills.

### trading-bot — ADR-driven, no harness
- 50-line CLAUDE.md but very prescriptive ("Phase 1 paper, Phase 2 real money", "10-guard execution gate is load-bearing", risk numbers cited inline).
- Zero `.claude/` directory. Zero hooks. Zero skills. Discipline lives in code + ADRs.
- Per-workstream directory CLAUDE.md copies (19) so each parallel branch has its operating context.
- What carelog could borrow: cite load-bearing numbers (PHI rule, $14/mo, branch-protect rules) inline, not via 6 separate references.

### gh-pr-quick-merge — script-heavy, harness-light
- 15-line CLAUDE.md (retro trigger only). Zero hooks, zero skills.
- Five real release scripts in `scripts/` (`release.sh`, `package-firefox.sh`, `vendor-sentry.sh`, etc.) — all bash, no markdown wrappers.
- Has both BACKLOG.md AND docs/plans AND docs/adr — full doc trifecta with no enforcement harness.
- Tells you the "harness" can be just discipline + scripts when the project is small.

### env-doc-ops + prediction-market-terminal — ADR-only
- Both lean on `docs/adr/` (1 and 12 entries respectively) as the durable decision record.
- Neither has BACKLOG, neither has hooks/skills.
- Prediction-market-terminal's 12 numbered ADRs (auth, ingestion, billing, alert DSL, OCR vendor, weather source, bot go-live, etc.) are the pattern carelog skipped — all those decisions live in BACKLOG/git-log instead.

---

## 4. Sophistication ranking

| Tier | Projects | Justification |
|---|---|---|
| **5 (heaviest)** | carelog, bcherny-claude | Carelog: 15 skills + 3 hooks + routing.yaml + 5 nested CLAUDEs + UI rules + 7 scripts. Bcherny: 6 agents + 7 commands as named files. |
| **4 (heavy)** | lease-analyzer, scu, trading-bot | Hooks or routing.yaml + sizeable per-project CLAUDE.md, but no project-local skills. |
| **3 (moderate)** | fathom, gh-pr-quick-merge, prediction-market-terminal, env-doc-ops, auto-exit | Substantial CLAUDE.md, BACKLOG and/or ADR conventions, no automation hooks. |
| **2 (light)** | 20carat, disclosure-archive, kalshi-edge, kalshi-weatherman, kalshi_structural_arb, e2e-medicinal-mushroom, law-4-kids-llc | Either a thin CLAUDE.md or just settings.json. Single discipline lever. |
| **1 (none)** | auto-rebaser, boring-apps, fleet, flush, qm-test-fixture, docs, handoff_pr_quick_merge_design | No CLAUDE.md, no `.claude/`. Operates entirely off global rules. |

---

## 5. Pros & cons of carelog's current harness

**Where carelog is best-in-class:**
- Only project with a project-local **skill library** of operational concern (deploy-autopilot, sentry-triage, schema-dump, supabase-types, ship-story, tdd-ship, review). These encode actual Carelog workflows, not generic patterns.
- `route-model-log.sh` hook is good — measurable routing data + active block on Haiku-overflow / Opus-on-mechanical. Other repos have a hot-forked copy; carelog's is the canonical.
- Pre-commit related-vitest gate is the right pattern for a 1900-test web suite. No peer has anything comparable for test scope.
- UI rules file (`ui-standards.md`) is enforced by reference from CLAUDE.md — no other project has a living design-rules pin.
- Single source of truth (BACKLOG.md) + sync skill is consistent and battle-tested.

**Where carelog is bloated:**
- 229-line `.claude/CLAUDE.md` for a solo bootstrapped project. Most peers ship in 15–50 lines. Many sections (worktree conventions, parallel work rules, scope contracts) repeat global `~/.claude/CLAUDE.md` content.
- "Known Gotchas" section has grown into a session-history graveyard (8+ dated entries). After PR #422 removed dispatch tooling, several gotchas reference removed flows — needs another pruning pass.
- 5 nested CLAUDE.mds. `apps/web/CLAUDE.md`, `apps/mobile/CLAUDE.md`, `supabase/CLAUDE.md`, `e2e/CLAUDE.md` plus root. Some (e.g., e2e) likely duplicate Playwright defaults.
- 15 project-local skills is a lot. Several (`add-component`, `expo`, `mobile-ui`) overlap with global plugin skills (`expo:*`, `chrome-devtools-mcp:*`).

**Where peers do better:**
- bcherny's discrete `.claude/agents/*.md` files are easier to invoke surgically than embedding personas in skill bodies.
- bcherny's `.claude/commands/grill.md` and `techdebt.md` are short, project-tunable slash commands. Carelog has none — relies on global slash commands only.
- trading-bot puts load-bearing numbers (sizing %, drawdown caps) directly in CLAUDE.md instead of behind a docs link. Carelog's PHI rule is inline (good) but `$14/mo`, e2e streak threshold, vitest count drift across files.
- prediction-market-terminal's 12 numbered ADRs would replace several long CLAUDE.md "rationale" paragraphs in carelog.
- lease-analyzer's `pr-ready-gate/last-run.log` shows a per-PR gate artifact pattern carelog could adopt for the deploy-autopilot script.

---

## 6. Addition candidates

| # | Source | What | Why for carelog | Effort |
|---|---|---|---|---|
| A1 | bcherny-claude | `.claude/commands/grill.md` (adversarial review of current diff before merge) | Codex adversarial gate is disabled until 2026-05-16. A small project-local `grill.md` would route to a Sonnet subagent for the same purpose — tighter than re-typing the brief each time. | 30 min |
| A2 | bcherny-claude | `.claude/commands/techdebt.md` (end-of-session dead-code scan) | Carelog's `session-end` skill closes the loop on memory + commit, but does not actively grep for dead code. Bcherny's pattern is a clean separation. | 30 min |
| A3 | prediction-market-terminal | `docs/adr/` directory + first 3 ADRs (PHI boundary, $14/mo billing model, BACKLOG-as-SoT) | Captures the "why" of decisions currently distributed across CLAUDE.md and PRs. Prevents re-litigation. | 90 min for first 3 ADRs |
| A4 | trading-bot | Inline citation of load-bearing numbers in CLAUDE.md | Pull `$14/mo`, vitest expected count (1900), e2e streak threshold into a single "constants" block at top of `.claude/CLAUDE.md`. | 15 min |
| A5 | lease-analyzer | `.claude/pr-ready-gate/last-run.log` pattern | Persist last `pre-deploy.sh` outcome so cross-session resume can read it instead of re-running. | 60 min (modify pre-deploy.sh to write log) |
| A6 | bcherny-claude | Discrete `.claude/agents/code-simplifier.md` | Pair with carelog's existing `simplify` global skill. A project-pinned reviewer that knows tokens, panel pattern, the no-`any` rule. | 45 min |

---

## 7. Removal candidates (post-PR #422)

PR #422 already deleted backlog-dispatch, worktree-subagents, pr-review-agent, plan-with-tests, the duplicate Reference tail, and the root preamble. What's left to consider:

- **`.claude/CLAUDE.md` "Known Gotchas" section** — prune entries dated >30 days old that reference removed flows (e.g., the 2026-05-01 subagent-context-exhaustion entry concerns the now-deleted `backlog-dispatch` workflow).
- **`add-component` skill** — likely a 5-line wrapper for `npx shadcn@latest add`. The `ui-standards.md` rule already says to use that command. Skill is redundant.
- **`mobile-ui` skill + `mobile-ui.sh` script + `expo` skill** — three overlapping mobile entrypoints when the global plugin already ships `expo:*` and `chrome-devtools-mcp:*` skills. Pick one.
- **`apps/mobile/CLAUDE.md`** — verify it adds Carelog-specific guidance vs. duplicating the global expo skills. If duplicate, delete.
- **`session-end` and `ship-story` project-local skills** — both names exist as global skills. Confirm the project-local versions add Carelog-specific content; if not, delete.
- **`scheduled_tasks.lock`** — stale lockfile from removed loop/schedule usage. Per global "No Overnight Plans" rule, delete.

---

## 8. Top 5 actionable next steps

1. **(S, ~30 min) Add `.claude/commands/grill.md`** — replicate bcherny's adversarial review pattern as a project slash command that dispatches a Sonnet subagent. Fills the Codex-adversarial gap until 2026-05-16.
2. **(S, ~30 min) Prune Known Gotchas** in `.claude/CLAUDE.md` — drop entries that reference removed dispatch/worktree-subagents flows. Drops ~50 lines.
3. **(M, ~60 min) Audit and dedupe project-local skills** — for each of the 15, run `ls ~/.claude/skills/` to check for global twin. Keep only those with Carelog-specific content (likely: deploy-autopilot, sentry-triage, schema-dump, supabase-types, create-migration, ship-story w/ BACKLOG flow, tdd-ship). Cut ~7 skills.
4. **(M, ~90 min) Seed `docs/adr/`** with three ADRs: (1) PHI/PostHog UUID-only rule, (2) BACKLOG.md as single source of truth, (3) $14/mo family-plan pricing. Reduces CLAUDE.md prose by ~25 lines.
5. **(L, ~2 hr) Consolidate mobile harness** — one of {`mobile-ui` skill, `mobile-ui.sh`, `expo` project-local skill}. Pick the script (most concrete), delete the two skills, point to global `expo:*` plugin for everything else.

---

*Generated 2026-05-10. Sources: filesystem inspection of `~/projects/*` (read-only), `git log`, no external API calls.*
