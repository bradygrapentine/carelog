---
name: dispatch
description: Parallel-subagent dispatcher with two input modes — (a) inline task list / table from the user, or (b) BACKLOG.md §1 Ready rows. Picks the right execution mode (plain implementation vs. /tdd-ship discipline) per input, sets up worktrees with symlinked node_modules, scope contracts, model routing, and arms auto-merge by default. Mirrors /wave's "one skill, picks the right mode" shape. Use whenever you want 2+ independent tasks running in parallel — backlog-driven OR ad-hoc.
user-invocable: true
---

# Dispatch

Single canonical fan-out skill. Owns input parsing, dispatch orchestration, and result reporting. Delegates the boilerplate (pre-flight checks, worktree setup, scope contract template) to `worktree-subagents` so there's exactly one source of truth for that.

**Announce at start:** "Using /dispatch in <ad-hoc | backlog> mode for N tasks."

---

## Mode selection

**Ad-hoc mode** — user supplies an explicit task list (inline or table):
```
/dispatch
1. Rename `foo` → `bar` across src/
2. Add Zod schema for PatientVitals in packages/schemas
3. Stub weekly-digest subject-line A/B test
```
or
```
/dispatch
| task | files | model |
|---|---|---|
| Rename foo → bar | src/**/*.ts | haiku |
| Add Zod schema | packages/schemas/patient-vitals.ts | haiku |
```

**Backlog mode** — user invokes with `--from-backlog`, or via the `/backlog-dispatch` alias, or says "burn down ready / dispatch the backlog / run all ready stories":
```
/dispatch --from-backlog          # all 🟢 Ready rows in BACKLOG.md §1
/dispatch --from-backlog TD-25 TD-26 TD-28   # specific subset
/backlog-dispatch                 # alias → same as --from-backlog
```

In backlog mode, the skill reads `BACKLOG.md` §1, picks `Status: 🟢 Ready` rows, and synthesizes the task list from each row's title + description + acceptance criteria.

---

## When NOT to use /dispatch

- Single task → `/ship-story`
- Broad exploration / file enumeration → `/ollama` (cheaper fanout)
- Tasks with shared files → run serially (worktrees can't help)
- Multi-layer single-feature parallel split (e.g. one agent on RLS, one on API for the same feature) → use `worktree-subagents` directly — `/dispatch` is for independent tasks, not coordinated layers

---

## Process

### 1. Validate input

**Ad-hoc mode:**
- For each task: list its target files. Two tasks listing the same file → STOP, ask user to serialize that pair.
- If model unspecified per task, default to `sonnet`.

**Backlog mode:**
- Read `BACKLOG.md`. Extract `Status: 🟢 Ready` rows.
- Drop any row where `Blocked by:` references an un-shipped item.
- Drop any row missing acceptance criteria → list as "needs spec" in the report.
- If `>5` Ready items, ask the user which 5 to start with (max 5 per dispatch — friction grows fast above that).

Print the dispatch list. For backlog mode, ask for confirmation before proceeding.

### 2. Pre-flight

Run `worktree-subagents` §1 verbatim. This covers:
- `git status` clean / on `main`
- Baseline tests green on HEAD (never dispatch into a broken baseline)
- Docker running if any task touches `supabase/`
- Ollama health check (optional)
- No interactive-login CLIs in scope
- DB table list to inject into prompts (prevents schema invention)
- **PHI keyword scan** on each task description (`posthog`, `analytics`, `identify`, `capture`, `email`, `auth`, `share_token`). Mark hits — those PRs require Opus review before merge instead of autonomous auto-merge.

### 3. Worktree setup (per task)

Run `worktree-subagents` §2 verbatim — `git worktree add` + the **two** node_modules symlinks. Never `pnpm install --frozen-lockfile` in a worktree (slow, duplicates the pnpm store, and the symlinks are documented in `.claude/CLAUDE.md` as the canonical approach).

Branch naming:
- Ad-hoc: `chore/dispatch-<slug>` or `feat/<slug>`
- Backlog: `feat/<id>-<slug>` (e.g. `feat/td-25-supabase-server-test`)

### 4. Dispatch in parallel

ONE message with multiple `Agent` tool calls so they run in parallel. Each Agent gets:
- `subagent_type`: `general-purpose` (or specialized agent if applicable)
- `model`: per-task preference; default `sonnet`; **never `haiku` if prompt > 6000 chars** (the `route-model` PreToolUse hook hard-blocks)
- `run_in_background`: `true` for fan-outs ≥ 3
- `prompt`: the `worktree-subagents` §3 scope contract, filled in

**Discipline directive in the contract:**
- Ad-hoc mode: "implement the task; tests where they make sense"
- Backlog mode: "**Follow `/tdd-ship`** — write failing tests first, iterate to green (max 5 iterations), then refactor. If stuck, escalate with a diagnostic instead of hacking around."

This delegates the red-green-refactor loop to the canonical TDD skill rather than re-stating it inline.

### 5. Collect results

As each agent finishes, receive its notification:
- `DONE` → push branch, open PR, **apply `queue` label** (`gh pr edit <num> --add-label queue`) — ~~Mergify~~ owns the queue here; `gh pr merge --auto --squash` races ~~Mergify~~ and is a no-op
- `DONE_WITH_PHI_TOUCH` (flagged in §2) → push + open PR, **do NOT auto-merge** — route to Opus for review first
- `DONE_WITH_CONCERNS` → read concerns, decide push-with-note vs. ask user
- `BLOCKED` → record reason; do NOT silently retry; surface to user

#### 5a. Verify the PR actually exists (REQUIRED)

When a subagent reports `DONE`, **always verify the PR landed before treating it as complete**. Subagents have run out of context mid-PR before — the agent declares "completed" while the worktree still has files staged-but-uncommitted, and no PR exists. Symptom: notification arrives, `gh pr list` shows nothing.

For each completed agent, run:

```sh
gh pr list --author @me --json number,headRefName \
  | jq -r --arg b "<branch>" '.[] | select(.headRefName == $b) | .number' \
  | grep -q . \
  || echo "[ALERT] subagent reported DONE but no PR exists for <branch>"
```

If the alert fires:
1. `cd .worktrees/<name>` and run `git status`. Expect either uncommitted files (finish the commit yourself + push + open PR) or a pushed branch with no PR (open the PR yourself).
2. **Do NOT redispatch the same agent** — it'll likely re-exhaust context the same way. Take the work over directly.

#### 5b. Discourage 4+-file dispatches

The most common path to "DONE but no PR" is a subagent dispatched with 4+ files to write before the final commit. The pre-commit vitest hook (~30–60s) inside `git commit` can exhaust the agent's remaining context. Soft guideline:

- **Plan-time question**: "Will this subagent need to write 4+ files?" If yes, prefer one of:
  - Split into two subagents on disjoint file subsets.
  - Brief the agent to **push after the first commit** (red-phase tests only) so subsequent green-phase commits land on the open PR even if context exhausts later.

This is a guideline, not a hard cap — some legitimate dispatches genuinely need 4+ files (e.g. a TDD spec-author writing failing tests across 4 files). But a 4+ dispatch without an early-push instruction is the failure mode.

### 6. Report (unified table)

```
| ID / Slug      | Branch                       | Model  | Status     | PR     | Tests        | Notes |
|----------------|------------------------------|--------|------------|--------|--------------|-------|
| TD-25          | feat/td-25-supabase-server   | sonnet | done       | #160   | 14 pass      | auto-merge armed |
| TD-26          | feat/td-26-offline-write     | sonnet | done       | #161   | 8 pass       | auto-merge armed |
| TD-28          | feat/td-28-inngest-failures  | sonnet | done+PHI   | #162   | 9 pass       | PHI-touch — Opus review before merge |
| dispatch-foo   | chore/dispatch-foo-rename    | haiku  | failed     | —      | tsc error    | type mismatch in foo.ts |
```

(`ID / Slug` = backlog ID in backlog mode, slug-from-task-1 in ad-hoc mode.)

### 7. Backlog-mode follow-up

After the table, run `/backlog-sync` to reconcile `BACKLOG.md` against the new PRs (status flips, §0 board, etc.). **Subagents must not edit `BACKLOG.md` themselves** — touching it from a feature PR creates rebase conflicts against every other open PR in the dispatch.

---

## Hard rules

- **Never** dispatch 7+ agents at once (friction outweighs parallelism — batch into waves).
- **Never** dispatch without a §3 scope contract.
- **Never** dispatch into a worktree without §2's two node_modules symlinks.
- **Never** auto-merge PHI-touching diffs (require Opus review first).
- **Never** let a subagent edit `BACKLOG.md`.
- **Never** dispatch into a broken baseline — pre-flight tests must be green on HEAD first.

---

## Integrations

- `worktree-subagents` — canonical primitive owning pre-flight (§1), worktree setup (§2), scope contract (§3). `/dispatch` references; never re-states.
- `/tdd-ship` — invoked per-task in backlog mode for the red-green-refactor discipline.
- `/ship-story` — single-story alternative; use when N=1.
- `/backlog-sync` — runs after backlog-mode dispatches to reconcile BACKLOG.md.
- `/wave` — calls into `/dispatch` (or direct implementation) per wave plan.
- `/routing-report` — after a run, check how the fleet routed (cost/speed review).
- `/backlog-dispatch` — thin alias for `/dispatch --from-backlog` (kept for muscle memory).
