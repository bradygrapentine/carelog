---
name: worktree-subagents
description: Canonical primitive for parallel-subagent dispatch — owns the pre-flight checklist, worktree-with-symlinks setup, and the scope-contract template. /dispatch references this skill rather than re-stating the boilerplate. Use directly when you want hand-rolled parallel work that doesn't fit /dispatch.
---

# Worktree Subagents — Carelog

Canonical primitive for parallel work that needs isolated file state. Owns the three reusable building blocks that `/dispatch` (and its `/backlog-dispatch` alias) consume:

1. **§1 Pre-flight checklist** — git/docker/baseline-test gates
2. **§2 Worktree setup with symlinks** — the only correct way to spin up a worktree in this repo
3. **§3 Scope contract template** — exactly what every subagent prompt must include

**When to use this skill directly** (instead of `/dispatch`):
- Two parallel implementations on the same feature where each owns a layer (e.g. one agent on `apps/web/api`, another on `supabase/migrations`)
- One-off coordination where `/dispatch`'s task-list framing doesn't fit
- You want to invoke just one of the three blocks without the full dispatch ritual

For 2+ independent tasks (ad-hoc list OR `BACKLOG.md` Ready burndown) → use `/dispatch`.

---

## §1 Pre-flight checklist (required before every dispatch)

Run these checks before creating worktrees or dispatching any subagent. Abort if any block.

```bash
# 1. Working tree clean
git status --short                               # must be empty
git branch --show-current                        # must be main (or shared parent)

# 2. Baseline tests green on HEAD — never dispatch into a broken baseline
cd apps/web && npx vitest run --reporter=dot 2>&1 | tail -3 && cd -
supabase test db 2>&1 | tail -3                  # only if any task touches supabase/

# 3. Docker running if any task touches Supabase / migrations
docker info > /dev/null 2>&1 && echo "docker ok" || echo "BLOCKER: start Docker first"

# 4. Ollama optional but faster for mechanical tasks
curl -sf http://localhost:11434/api/tags > /dev/null && echo "ollama ok" || echo "ollama unavailable — subagents will use Claude directly"

# 5. No interactive-login CLIs in scope
#    If a task requires `eas login` / `supabase login` — ask the user to run it first

# 6. Pass relevant DB table names in subagent prompts (prevents schema invention)
grep -r "create table" supabase/migrations/ | tail -20

# 7. PHI-keyword scan on each task description (any of: posthog, analytics, identify,
#    capture, email, auth, share_token). Flag matching tasks: their PR diffs require
#    Opus review before merge — not autonomous merge.
```

If baseline tests fail, **stop and report**. Do not dispatch into a broken HEAD.

---

## §2 Worktree setup with symlinks

The `node_modules` symlink step is **non-negotiable**. Without it, the pre-commit `vitest run` hook fails inside the worktree even when the code is correct (documented in `.claude/CLAUDE.md` known-gotchas). `pnpm install --frozen-lockfile` in a worktree wastes ~5 min and duplicates the pnpm store and Playwright browsers.

```bash
# Per worktree:
SLUG=<short-name>                                # e.g. ratelimit-api, td-25-supabase-test
BRANCH=<branch-name>                             # e.g. feat/td-25-supabase-server-test

git worktree add .worktrees/$SLUG origin/main -b $BRANCH

ln -s /Users/bradygrapentine/projects/carelog/node_modules .worktrees/$SLUG/node_modules
ln -s /Users/bradygrapentine/projects/carelog/apps/web/node_modules .worktrees/$SLUG/apps/web/node_modules
```

Naming convention: `<feature>-<layer>` for multi-layer features (`invite-web`, `invite-rls`), or `<id>-<slug>` for backlog items (`td-25-supabase-test`).

**Always base on `origin/main`**, not local `main` — avoids picking up uncommitted local changes.

---

## §3 Scope contract template (required in every subagent prompt)

Paste verbatim into each Agent prompt, filling the bracketed fields. Subagents that go out of scope (add unrelated features, leak PHI, commit to `main`, edit `BACKLOG.md` from a feature branch) require reverts and cherry-picks. The contract prevents this.

```
WORKING DIRECTORY: /Users/bradygrapentine/projects/carelog/.worktrees/<slug>
BRANCH: <branch>  (verify with `git branch --show-current` before EVERY commit)

FILES ALLOWED: [exact list of files this subagent may create or modify]

DO NOT:
  - Add features outside this task
  - Touch files not listed above
  - Commit to main (the harness hook hard-blocks this)
  - Edit BACKLOG.md (status flips happen via /backlog-sync after merge — touching
    BACKLOG.md from a feature PR creates rebase conflicts against every other open PR)
  - Pass email or any PHI to analytics

PHI RULE: posthog.identify() and posthog.capture() must use anonymous UUID only —
          never email, name, phone, or any PII/PHI.

VERIFY (before commit):
  - Run the relevant tests (`cd apps/web && npx vitest run` for web, `supabase test db`
    for RLS, etc.) and confirm green
  - Summarize: what changed, what was intentionally NOT changed

TASK: <the task description, including acceptance criteria>
```

For backlog stories, add a TDD discipline line: **"Follow `/tdd-ship` — write failing tests first, iterate to green, then refactor."** This delegates the red-green-refactor loop and its escalation policy to the canonical TDD skill rather than re-stating it.

---

## §4 Dispatch in parallel

Use a SINGLE message with multiple `Agent` tool calls — Claude Code runs them in parallel. Each Agent gets:

- `subagent_type`: `general-purpose` (or a specialized agent if applicable)
- `model`: `sonnet` default; `haiku` for known-pattern single-file work; **never `haiku` if the prompt exceeds 6000 chars** (the `route-model` PreToolUse hook hard-blocks this)
- `run_in_background`: `true` for fan-outs of 3+ so the orchestrator's context isn't tied up
- `prompt`: the §3 scope contract

**Hard caps:**
- Never dispatch 7+ agents at once — friction outweighs the parallelism. Batch into waves.
- Never dispatch without a §3 scope contract.
- Never dispatch into a worktree without §2's symlinks.

---

## §5 Review & integrate

When subagents return:

1. Read each diff: `git -C .worktrees/<slug> diff origin/main`
2. Check for: invented DB tables, out-of-scope file changes, PHI in `identify`/`capture`
3. If clean and tests green → push branch + open PR + apply ~~Mergify~~ `queue` label:
   ```sh
   gh pr create --title "..." --body "..."
   gh pr edit <num> --add-label queue        # ~~Mergify~~ owns the queue (see CLAUDE.md §Merge Queue)
   ```
4. If a subagent returned `BLOCKED` → record reason, don't retry silently
5. If a subagent's diff touches PHI surfaces (flagged in §1 step 7) → **do not auto-merge**; route to Opus for review first

---

## §6 Cleanup

After PRs are open (or merged):

```bash
git worktree remove .worktrees/<slug>
git worktree prune                                # removes stale entries
```

`.worktrees/` is gitignored — worktrees won't appear in `git status` on the main branch.

---

## Carelog-specific notes

- **`supabase test db` runs from main project root**, not from a worktree — RLS tests always run against the local Supabase instance bound to the root.
- **`pnpm test` runs from the worktree root** — pnpm workspace resolves correctly from subdirs once §2's symlinks are in place.
- **Mobile + web** is a clean parallel split: different codebases, rarely share files.
- **RLS migration + API route** is the other common split: one agent on `supabase/`, one on `apps/web/app/api/`.
- **Never share a worktree between agents** — one worktree, one agent.
