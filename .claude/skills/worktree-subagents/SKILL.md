---
name: worktree-subagents
description: Use when dispatching parallel subagents that need isolated file state — feature branches, simultaneous multi-layer implementation, or parallel test fixes that touch overlapping files
---

# Worktree Subagents — Carelog

Use when two or more subagents would otherwise edit the same files, or when you want each agent to commit independently on its own branch without touching the main working tree.

**When to use worktrees vs plain parallel agents:**

- Plain parallel agents: independent files, no shared state → no worktree needed
- Worktree agents: overlapping files, or each agent needs its own branch → use this skill

---

## Step 1 — Create a worktree per agent

```bash
git worktree add .worktrees/<feature-name> origin/main
```

Naming convention: `<feature>-<layer>` — e.g. `invite-web`, `invite-rls`, `auth-refactor-mobile`

```bash
# Example: two agents implementing an invite hardening feature
git worktree add .worktrees/invite-web origin/main
git worktree add .worktrees/invite-rls origin/main
```

Each worktree gets its own branch automatically named after the directory.

---

## Step 2 — Dispatch subagents with scoped paths

Craft each agent prompt with the worktree path as the working directory and an explicit scope boundary:

```
Agent 1 prompt:
  Working directory: /path/to/project/.worktrees/invite-web
  Task: [specific task]
  Scope: Only touch apps/web/app/api/invite/
  Do NOT touch: supabase/, apps/mobile/, packages/

Agent 2 prompt:
  Working directory: /path/to/project/.worktrees/invite-rls
  Task: [specific task]
  Scope: Only touch supabase/migrations/ and supabase/tests/
  Do NOT touch: apps/
```

Dispatch both agents in a single message so they run in parallel.

---

## Step 3 — Review and integrate

When both agents return:

1. Review each agent's diff in its worktree:

   ```bash
   git -C .worktrees/invite-web diff origin/main
   git -C .worktrees/invite-rls diff origin/main
   ```

2. Check for conflicts between the two diffs — look for any files both agents touched

3. Merge or cherry-pick into main working tree:

   ```bash
   # Option A: cherry-pick commits
   git cherry-pick .worktrees/invite-web/<branch-tip>

   # Option B: merge the branch
   git merge .worktrees/invite-web/<branch>
   ```

4. Run the full test suite after integration:
   ```bash
   pnpm test && supabase test db
   ```

---

## Step 4 — Cleanup

After merging, remove worktrees:

```bash
git worktree remove .worktrees/invite-web
git worktree remove .worktrees/invite-rls
```

Or remove all at once:

```bash
git worktree prune
```

`.worktrees/` is gitignored — worktrees won't appear in git status on the main branch.

---

## Carelog-Specific Notes

- **Always base on `origin/main`**, not local main — avoids picking up uncommitted local changes
- **RLS migrations + API routes** are the most common parallel split: one agent on `supabase/`, one on `apps/web/app/api/`
- **Mobile + web** is another clean split: different codebases, rarely share files
- **Never share a worktree between agents** — one worktree, one agent
- **Supabase CLI** (`supabase test db`) must be run from the main project root, not from a worktree — RLS tests always run against the local Supabase instance
- If an agent needs to run `pnpm test`, it should run from its worktree root (pnpm workspace resolves correctly from subdirs)

---

## Example: Parallel Feature Branch

```
User: "Implement rate-limiting on invite routes and add pgTAP tests for the new RLS policy"

→ Two independent pieces: API code + RLS migration
→ Create two worktrees, dispatch two agents
→ Review diffs, integrate, run full suite
```

```bash
git worktree add .worktrees/ratelimit-api origin/main
git worktree add .worktrees/ratelimit-rls origin/main
```

Agent 1 (in `.worktrees/ratelimit-api`): Add rate limiting to `apps/web/app/api/invite/`
Agent 2 (in `.worktrees/ratelimit-rls`): Add migration + pgTAP tests in `supabase/`
