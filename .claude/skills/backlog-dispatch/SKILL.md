---
name: backlog-dispatch
description: Dispatch parallel subagents against all Ready items in BACKLOG.md — each item gets its own worktree, feature branch, tests-first implementation, and PR. Returns a consolidated report. Use for overnight batch execution.
user-invocable: true
---

# Backlog Dispatch

Parallel execution of all Ready backlog items via worktree subagents. Each item runs independently; results are consolidated at the end.

**Announce at start:** "I'm using the backlog-dispatch skill to fan out BACKLOG.md Ready items."

## Pre-dispatch checks

Run these before dispatching anything. Abort if any fail:

```bash
# 1. Verify branch
git branch --show-current   # must be main

# 2. Verify clean state
git status --short          # must be empty

# 3. Verify tests pass on HEAD
pnpm test 2>&1 | tail -5
supabase test db 2>&1 | tail -5

# 4. Verify Ollama (optional but faster for mechanical tasks)
curl -sf http://localhost:11434/api/tags > /dev/null && echo "ollama ok" || echo "ollama unavailable — subagents will use Claude directly"

# 5. Verify worktrees will have node_modules — bootstrap after each worktree creation
#    cd .worktrees/<name> && pnpm install --frozen-lockfile
#    Do this BEFORE dispatching the subagent, not inside the subagent prompt

# 6. Docker running if any Ready item touches supabase/migrations/
docker info > /dev/null 2>&1 && echo "docker ok" || echo "WARN: start Docker if any item has a migration"
```

If tests are failing on HEAD, stop and report. Do not dispatch into a broken baseline.

## Read BACKLOG.md

Read `BACKLOG.md`. Extract all rows where `Status: 🟢 Ready`. For each, note:
- **ID** (e.g. `ON-42`)
- **Title**
- **Description / acceptance criteria**
- **Files** (if listed)
- **Dependencies** (skip if `Blocked by:` points at an un-shipped item)

Print the dispatch list before starting. Ask for confirmation if >5 items.

## Dispatch (one subagent per item)

For each Ready item, dispatch a single Agent tool call. All dispatches go in ONE message for parallel execution.

Each subagent prompt must include the full scope contract:

```
You are implementing backlog item [ID]: [Title]

BRANCH: feature/[id-slug]  (verify with `git branch --show-current` before every commit)
FILES ALLOWED: [list from backlog row, or derive from description]
DO NOT: add features outside this ticket, touch files not listed, pass email/PHI to analytics
PHI RULE: posthog.identify() and posthog.capture() must use UUID only
WORKTREE: git worktree add .worktrees/[id-slug] origin/main && cd .worktrees/[id-slug] && git checkout -b feature/[id-slug]

Steps:
1. Read the relevant files first
2. Write failing tests covering the acceptance criteria
3. Run tests — confirm they fail
4. Implement minimally until tests pass
5. Run `pnpm typecheck && pnpm test && supabase test db` (skip pgTAP if no migration)
6. Commit on branch feature/[id-slug]
7. Open a PR: gh pr create --title "[ID]: [Title]" --body "Implements [ID]. Tests: passing. Changed: [list]. NOT changed: [list]."
8. Clean up worktree: cd ../.. && git worktree remove .worktrees/[id-slug]

Return: PR URL, test summary (pass/fail counts), list of files changed, and a one-line "what I did NOT change" note.
```

## Consolidate results

After all subagents return, print a table:

```
| ID    | Title           | Status  | PR    | Tests      | Notes |
|-------|-----------------|---------|-------|------------|-------|
| ON-42 | Feature X       | done    | #123  | 14 pass    |       |
| ON-43 | Feature Y       | failed  | —     | 3 fail     | tsc error in types.ts |
| ON-44 | Feature Z       | skipped | —     | —          | blocked by ON-43 |
```

Then run `/backlog-sync` to update BACKLOG.md status board.

## Rules

- Never merge PRs — open only. Brady reviews and merges.
- Never commit to `main` directly.
- If a subagent fails, record the failure and continue with others — don't abort the batch.
- Max 5 items per dispatch. If BACKLOG.md has more Ready items, ask which 5 to start with.
- If an item has no acceptance criteria, skip it and list it as "needs spec" in the report.
- Before dispatching, scan each Ready item's description for PHI-touching work (keywords: `posthog`, `analytics`, `identify`, `capture`, `email`, `auth`). Flag those tickets — their PRs require Opus review before merge, not autonomous merge.
