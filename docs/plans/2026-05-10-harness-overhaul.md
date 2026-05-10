# Harness Overhaul Plan — 2026-05-10

**Source audit:** `docs/notes/2026-05-10-harness-comparison.md` (PR #423)
**Predecessor:** PR #422 (removal pass — backlog-dispatch, worktree-subagents, pr-review-agent, plan-with-tests, duplicate Reference tail, root preamble)
**Goal:** Take Carelog's harness from "heaviest in portfolio" toward "heaviest *that earns its weight*". Concretely: add what's missing (slash commands, ADRs, inline constants), prune what's still redundant (gotchas referencing removed flows, skill duplicates), consolidate the mobile entrypoints.

## Scope discipline

This plan is **NOT** "massive overhaul" in the architectural sense. It is **five concrete tracks of small additions and deletions** that can be executed in parallel by Opus subagents. Total estimated effort: 4–5 hours wall time across 4 parallel agents + 1 serial validation pass.

**Out of scope tonight:**
- A5 (`.claude/pr-ready-gate/last-run.log` artifact) — touches `scripts/pre-deploy.sh`, more invasive than additions warrant. File as TD if still desired.
- A6 (`.claude/agents/code-simplifier.md`) — needs design conversation; not just a port.
- Step 5 (mobile harness consolidation, L-effort) — requires content-comparison judgment between `mobile-ui` skill, `mobile-ui.sh`, `expo` skill, and `apps/mobile/CLAUDE.md`. Save as a follow-up plan.

## Parallel tracks (no file overlap)

### Track 1 — Slash commands (Track-1 agent)
**FILES ALLOWED:** Create only.
- `.claude/commands/grill.md` — adversarial review of current branch diff. Dispatches a Sonnet subagent with the standard "must-fix / should-fix / nit, file:line cited" brief. Replaces Codex adversarial gate during the Codex-disabled window (until 2026-05-16) and is useful afterward as a lighter-weight gate.
- `.claude/commands/techdebt.md` — end-of-session dead-code / TD-discovery scan. Greps for TODO, FIXME, HACK, dead exports; reports findings. Does NOT create BACKLOG rows automatically (per CLAUDE.md "Add new TD rows in dedicated `chore(backlog):` PRs").

**Acceptance:**
- Both files exist and are valid markdown with `---` frontmatter (YAML), description, body.
- `.claude/commands/grill.md` invokes a Sonnet subagent (NOT Opus — wrong cost profile for adversarial review).
- `.claude/commands/techdebt.md` is read-only — does NOT modify BACKLOG.md.
- Reference both from `.claude/CLAUDE.md` (Track 3 will add).

**Effort:** ~30 min.

### Track 2 — ADR scaffold + first 3 ADRs (Track-2 agent)
**FILES ALLOWED:** Create only.
- `docs/adr/README.md` — index + format guidance. Use the `write-adr` global skill's expected format if it has one; otherwise standard ADR template.
- `docs/adr/0001-phi-anonymous-uuid-only.md` — captures the rule: `posthog.identify()` and `posthog.capture()` MUST use anonymous UUID only — never email, name, phone. Context: caregiver platform handles PHI; analytics must not be a PHI sink. Decision date: pre-existing rule, ADR codifies it.
- `docs/adr/0002-backlog-as-single-source-of-truth.md` — BACKLOG.md is the only place planned work lives. Feature/fix PRs do NOT touch BACKLOG.md. New rows live in dedicated `chore(backlog):` PRs. `/backlog-sync` reconstructs status from git log + PR list. Context: 2026-04-25 session was 90% rebase pain because 5 of 7 PRs touched BACKLOG.md.
- `docs/adr/0003-family-plan-pricing-14-monthly.md` — $14/month family plan. Context: bootstrapped, no investor, single price point. Rationale: simple, undercuts hospice software, premium-feel without enterprise tax.

**Acceptance:**
- All 4 files exist.
- `README.md` index lists the 3 ADRs with one-line summaries.
- Each ADR has: Context, Decision, Consequences, Status (Accepted), Date.
- ADR numbering uses `NNNN-kebab-case-slug.md` convention.

**Effort:** ~90 min.

### Track 3 — CLAUDE.md prune + constants block (Track-3 agent)
**FILES ALLOWED:** Modify only `.claude/CLAUDE.md`.

**Two surgical changes:**

1. **Add a "Load-bearing constants" block at the top** (after the opening line, before "Design context"). Inline the values that drift across files:
   - `$14/mo family plan` (currently in line 3 — leave inline; this block consolidates *all* such numbers in one place)
   - Web vitest expected count: ~1900 tests across 240+ files (already in §Commands; pin canonically here)
   - Pre-commit hook scope: scoped vitest on related files only
   - Branch protection: GitHub native auto-merge, `--auto --squash`
   - Codex-disabled-until: 2026-05-16 (already in global; still useful at-a-glance here)

2. **Prune Known Gotchas section** — drop entries that reference removed flows:
   - "Parallel subagent BACKLOG.md conflicts" entry referenced `backlog-dispatch` skill (now deleted by PR #422). Trim or rewrite to reference `dispatch --from-backlog` only.
   - "Worktree commits + main-branch guard hook" — keep (still relevant).
   - "Subagent context exhaustion mid-commit (2026-05-01)" — keep (still relevant; just dispatch-agnostic).
   - Any entry older than 2026-04-15 that no longer maps to current code — flag for deletion in PR body, delete only those clearly stale.

3. **Reference the new commands** added by Track 1: under "Reference Docs (load on demand)" or a new "Project slash commands" section, add:
   - `/grill` — adversarial review of current diff
   - `/techdebt` — end-of-session dead-code scan

**Acceptance:**
- `.claude/CLAUDE.md` has new "Load-bearing constants" block within first 30 lines.
- "Known Gotchas" section is shorter (target: cut ~30 lines of stale entries).
- Two `/grill` and `/techdebt` references added.
- Pre-commit gate green (this is doc-only — should pass).

**Effort:** ~45 min.

### Track 4 — Skill dedup pass (Track-4 agent)
**FILES ALLOWED:** Delete only — entire `.claude/skills/<name>/` folders.

**Procedure:**
1. List all global skills: `ls ~/.claude/skills/`.
2. For each of carelog's 15 project-local skills (`add-component, create-migration, deploy-autopilot, dispatch, expo, live-test, mobile-ui, ollama, review, schema-dump, sentry-triage, session-end, ship-story, supabase-types, tdd-ship, test-gaps`), check:
   - Does a global skill with the same name exist?
   - If yes: diff the SKILL.md content. If project-local has Carelog-specific content (mentions BACKLOG.md, pgTAP, RLS, Supabase, PostHog UUID rule, $14/mo, etc.), KEEP. Otherwise DELETE.
   - If no: KEEP.
3. **Confirmed deletion candidates per audit §7:**
   - `.claude/skills/add-component/` — likely a 5-line shadcn wrapper duplicating `add-component` global. Verify, delete if confirmed.
   - **DO NOT touch** `mobile-ui`, `expo`, `apps/mobile/CLAUDE.md` — those are Track 5 (deferred).

**Acceptance:**
- Every deletion documented in PR body with one-line "kept global X is sufficient because Y".
- Every kept skill has a one-line "kept because contains Carelog-specific content: Z" justification.
- Skill count reduction documented (target: 15 → ~12).

**Effort:** ~60 min.

## Sequencing

All 4 tracks dispatch in **parallel** off `origin/main` (current SHA: `fb282ba`). No file overlap:

| Track | Files |
|---|---|
| 1 | `.claude/commands/grill.md`, `.claude/commands/techdebt.md` (new) |
| 2 | `docs/adr/README.md`, `docs/adr/0001-*.md`, `0002-*.md`, `0003-*.md` (new) |
| 3 | `.claude/CLAUDE.md` (modify) |
| 4 | `.claude/skills/<various>/` (delete folders) |

Track 3 will reference the slash commands Track 1 creates. If Track 1 lands first, Track 3 can use specific filenames; if not, Track 3 references them by intended path. Either is fine.

## Validation pass (serial, after all 4 PRs land)

After all 4 PRs auto-merge, the orchestrator (me) runs:
1. `cd apps/web && npx vitest run --reporter=dot 2>&1 | tail -5` — green.
2. `ls .claude/commands/ docs/adr/ .claude/skills/` — confirm new artifacts present.
3. `wc -l .claude/CLAUDE.md` — confirm net reduction (was 229 lines).
4. Grep `.claude/CLAUDE.md` for any reference to a now-deleted skill — fix if found.
5. Read first 50 lines of `.claude/CLAUDE.md` — confirm Load-bearing constants block present and well-formed.
6. Quick read of `docs/adr/README.md` — confirm 3 ADRs listed.

If any check fails → single follow-up PR to fix, do not re-dispatch.

## Risk register

- **Subagent reports work it didn't do.** Mitigation: each dispatch contract requires `git log --oneline -1` + file `ls -la` in the return summary. If reported file isn't in the actual `git show` of the PR, halt and investigate.
- **Two tracks accidentally edit the same file.** Mitigation: file partitions above. If Track 4's skill deletions remove a skill referenced in CLAUDE.md, Track 3 may need a follow-up — flag in validation pass, do not auto-fix mid-flight.
- **PR #422 still in flight when this dispatches.** Mitigation: PR #422 already merged (commit `fef82f5`). All tracks branch off `fb282ba` (post-#423).
- **Audit doc references go stale.** This plan is dated 2026-05-10. If executed >7 days from now, re-audit first.

## Out of scope (file as backlog if still wanted)

- Mobile harness consolidation (Track 5 in original audit §8) — needs content review.
- `.claude/pr-ready-gate/last-run.log` — modify scripts/pre-deploy.sh.
- `.claude/agents/code-simplifier.md` (bcherny-style) — design conversation needed first.

## Returns from execution

Each subagent returns:
1. PR URL.
2. Bullet list of files created/modified/deleted.
3. `git log --oneline -1` showing their commit.
4. `ls -la` of the files they claim to have created.

Orchestrator collects all 4 PRs, runs validation pass, reports a single consolidated summary.
