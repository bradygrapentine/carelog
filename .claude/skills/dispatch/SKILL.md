---
name: dispatch
description: Ad-hoc parallel fan-out of 2+ independent tasks to subagents with automatic worktree setup, node_modules symlinks, scope contracts, and Sonnet-by-default routing. Different from /backlog-dispatch (which walks BACKLOG.md §1 Ready rows) — use /dispatch when you have a specific list of tasks in mind that aren't backlog stories.
user-invocable: true
---

# Dispatch

Fan-out executor for 2+ independent tasks. Packages the ritual you've been doing manually (worktree, symlink, scope contract, Sonnet, background agent) into a single skill.

**Announce at start:** "Using /dispatch to fan out N tasks in parallel."

## When to use

- 2–6 independent tasks, different files, no shared state
- You already know what each task is (scope is clear)
- You want them running in parallel in worktrees

**Don't use for:**
- Backlog work → use `/backlog-dispatch`
- Single task → use `/ship-story`
- Broad exploration → use `/ollama` for cheap fanout
- Tasks with shared files → do serially

## Input format

The user gives you a list of tasks, either inline or as a markdown table:

```
/dispatch
1. Rename `foo` → `bar` across src/
2. Add Zod schema for PatientVitals in packages/schemas
3. Stub weekly-digest subject-line A/B test
```

Or:

```
/dispatch
| task | files | model |
|---|---|---|
| Rename foo → bar | src/**/*.ts | haiku |
| Add Zod schema | packages/schemas/patient-vitals.ts | haiku |
| A/B stub | inngest/functions/weeklyDigest.ts | sonnet |
```

If model is not specified, default to `sonnet`.

## Process

### 1. Validate independence
For each task: list its target files. If two tasks list the same file, STOP and ask the user to serialize that pair. Parallel work on the same file creates conflicts.

### 2. Pre-flight
- `git status` clean
- `git branch --show-current` = main (or a shared parent branch)
- For each task, pick a short branch name: `chore/dispatch-<slug>` or `feat/<slug>`

### 3. Create worktrees + symlink node_modules

For each task:
```sh
git worktree add .worktrees/<slug> origin/main -b <branch>
ln -s /Users/bradygrapentine/projects/carelog/node_modules .worktrees/<slug>/node_modules
ln -s /Users/bradygrapentine/projects/carelog/apps/web/node_modules .worktrees/<slug>/apps/web/node_modules
```

### 4. Dispatch in parallel

Use a SINGLE message with multiple `Agent` tool calls — Claude Code runs them in parallel. Each Agent gets:
- `subagent_type`: `general-purpose` (or a specialized agent if applicable)
- `model`: the per-task preference (default sonnet)
- `run_in_background`: `true`
- `prompt`: full scope contract:
  ```
  FILES ALLOWED: [...from input]
  BRANCH: <branch>
  WORKING DIRECTORY: /.../.worktrees/<slug>
  DO NOT: features outside this task, PHI in analytics, commit to main, edit BACKLOG.md (status updates happen via /backlog-sync after merge — touching BACKLOG.md from a feature PR creates rebase conflicts against every other open PR)
  PHI RULE: posthog.identify/capture UUID only
  VERIFY: tests before commit, diff summary in response
  TASK: <the task description>
  ```

### 5. Route by size (enforced by the PreToolUse hook)

The `.claude/hooks/route-model-log.sh` hook will **block** Haiku calls above 6000-char prompts. If a task's prompt exceeds that, escalate to Sonnet before dispatching — don't fight the hook.

### 6. Collect results

As each agent finishes, receive its notification. For each:
- If `DONE` → create PR (follow `/ship-story` Step 9).
- If `BLOCKED` → record the reason; don't retry silently. Ask the user or file a BACKLOG row.
- If `DONE_WITH_CONCERNS` → read the concerns, decide whether to push-with-note or ask user.

### 7. Report

Table of results:
```
| Task | Branch | Model | Status | PR |
|---|---|---|---|---|
| ...  |   ...  |  ...  |  ...   | #... |
```

## Hard rules

- **Never** dispatch 7+ agents at once. The friction gets worse than serial.
- **Never** dispatch to Haiku with a >6000-char prompt (the hook blocks it anyway).
- **Never** dispatch without a scope contract.
- **Never** auto-merge PRs from a /dispatch run — PRs stay open for human review.

## Integrations

- `/worktree-subagents` — lower-level worktree-setup primitive
- `/backlog-dispatch` — backlog-driven equivalent
- `/routing-report` — after a run, check how the fleet routed (cost/speed review)
