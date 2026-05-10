# Carelog — Harness Usage

How the Claude Code harness actually runs in this project: hooks, skills, agents, MCP servers, plugin priority, model routing, automation, and the Mergify-based merge flow.

This file is **load-on-demand reference**. Behavioral rules that drive Claude's actions live in `.claude/CLAUDE.md`; this file is the longer description of the machinery that supports them.

## Merge Queue (~~Mergify~~)

Repo uses **~~Mergify~~ merge queue** (as of 2026-04-25, replacing GitHub native auto-merge — see #163, #166). Config lives at ~~`.mergify.yml`~~. ~~Mergify~~ batches up to 5 PRs into one CI run on a synthetic merge SHA, eliminating the rebase-storm tax that armed auto-merge incurred when multiple PRs targeted main concurrently (O(N²) → O(N)).

### How to merge a PR

```sh
gh pr edit <num> --add-label queue
```

~~Mergify~~ watches for the `queue` label and routes the PR into the default queue. Don't use `gh pr merge --auto --squash` — GitHub native auto-merge races ~~Mergify~~ (auto-merge rebases the PR head; ~~Mergify~~ queues a synthetic merge SHA).

### Pre-queue validation (run BEFORE `--add-label queue`)

~~Mergify~~ won't queue a PR with failing required checks or conflicts. Quick check:

```sh
PR=<num>
gh pr view "$PR" --json mergeable,mergeStateStatus -q '.mergeable + " / " + .mergeStateStatus'
#   Want: MERGEABLE / anything-but-DIRTY. CONFLICTING/DIRTY → rebase first.

gh pr checks "$PR" 2>&1 | grep -E "fail" | head -5
#   Want: empty. Any "fail" → fix or rerun before labeling.
```

### Wakeup-on-label

When you add the `queue` label, **always schedule a wakeup** (10-15 min) to verify the PR landed. ~~Mergify~~ will comment on the PR if it can't queue (config issue, missing checks, conflicts). Silent stalls are the worst failure mode — the wakeup converts them into actionable signal.

### Failure-mode shortlist
- **~~Mergify~~ won't queue** → check the PR for a ~~Mergify~~ comment explaining why; usually a missing required check or a conflict.
- **Batch fails CI on the merge SHA** → ~~Mergify~~ bisects to find the bad PR and ejects it; sibling PRs continue.
- **`Configuration changed` check fails** → ~~`.mergify.yml`~~ syntax error; ~~Mergify~~ dashboard link in the check details has the parse error.
- **Conflict appears while queued** → ~~Mergify~~ ejects + comments; rebase (`git rebase origin/main`) + re-add label.
- **Required-check name drift** → if a workflow renames a check, update both ~~`.mergify.yml`~~ queue_conditions AND branch protection required-checks; otherwise ~~Mergify~~ never finds the check.

## Subagent Dispatch — pre-flight checklist

Before every dispatch (inline checklist in each dispatch skill):

- Each worktree has `node_modules` — either run `pnpm install`, or **faster**: symlink from main repo:
  ```sh
  ln -s /Users/bradygrapentine/projects/carelog/node_modules .worktrees/<name>/node_modules
  ln -s /Users/bradygrapentine/projects/carelog/apps/web/node_modules .worktrees/<name>/apps/web/node_modules
  ```
  Without this, the pre-commit hook `cd apps/web && npx vitest run` fails inside the worktree even when the code is correct. Symlink reuses the main repo's Playwright browsers and pnpm store — `pnpm install` in a worktree duplicates them unnecessarily.
- Each subagent's target branch ≠ `main` (verify with `git branch --show-current`)
- Docker running if Supabase/migration work is involved
- No interactive-login CLIs in scope (eas login, supabase login, etc.)
- Pass relevant DB table names in the prompt to prevent schema invention

## Automation & Sessions

- `/loop` — run a skill on a recurring interval **during an active session only** (e.g. polling a build for ~5 minutes). Do not use for unattended runs.
- `/schedule` — **do not use.** Carelog runs no overnight or scheduled Claude work; per global "No Overnight Plans" rule.
- `/btw` — side query without interrupting current work

## Ollama Dispatch

Local (and cloud) Ollama models are the primary backend for parallel, mechanical, or exploratory subtasks. Claude Code stays as the orchestrator.

### When to dispatch to `/ollama`

- 3+ independent subtasks that can run in parallel
- Exploration: reading many files, enumerating matches, summarizing docs
- Known-pattern boilerplate: test scaffolds, component shells, migration stubs
- Bulk mechanical work where correctness is cheap to verify afterward

### When to keep in Claude Code

- Multi-file architecture decisions
- RLS / security / auth changes
- Plugin orchestration and skill invocation
- Anything that needs full project context

### Model Hierarchy (cheapest capable model wins)

| Tier | Model | Use for |
|------|-------|---------|
| 1 — Opus | this session | Planning, architecture, security/RLS/PHI, coordination, final verification |
| 2 — Sonnet | `Task` tool | Multi-file implementation (2–6 files), moderate refactors, mid-tier orchestration |
| 3 — Haiku | `Task` tool | Single-file changes, known-pattern tasks, review, fast exploration |
| 4 — Ollama | `/ollama` | Boilerplate shells, grep/glob searches, single-function stubs, bulk parallel work |

### Routing Guide

| Task | Use |
|------|-----|
| Planning / architecture / RLS / PHI | Opus (this session) |
| Cross-layer orchestration, plan authoring | Opus (this session) |
| Final verification before PR/merge | Opus (this session) |
| Multi-file implementation (spec ready, 2–6 files) | Sonnet via `Task` tool |
| Moderate refactor with judgment calls | Sonnet via `Task` tool |
| Sonnet orchestrating Ollama fan-out | Sonnet via `Task` tool |
| Single-file change / known pattern | Haiku via `Task` tool |
| Code review (style, logic, standards) | Haiku via `Task` tool |
| Writing tests to an existing pattern | Haiku via `Task` tool |
| Adding types/Zod schemas to existing file | Haiku via `Task` tool |
| Parallel boilerplate (component shells, stubs) | `/ollama` |
| Codebase exploration (grep/glob, file enumeration) | `/ollama` |
| Bulk mechanical fixes (batch test failures) | `/ollama` with `qwen3-coder` |
| Single-function stubs with clear signature | `/ollama` |
| Doc comment / JSDoc generation | `/ollama` |
| Summarizing docs or reference files | `/ollama` |
| Migration + pgTAP scaffold | `/create-migration` |
| Security / adversarial review | `/review` skill |

**Rule:** Before starting any subtask, ask: can this go one tier lower? Delegate until the task genuinely needs judgment or full project context. Opus never does mechanical work directly.

**Pattern — Sonnet + Ollama handoff:**
Opus writes the plan → dispatch Sonnet subagent with the plan → Sonnet fans out mechanical pieces to `/ollama` and synthesizes results. This keeps Opus's context window clean.

### Health check before dispatch

```bash
curl -sf http://localhost:11434/api/tags > /dev/null && echo "ollama ok" || echo "ollama not running — start with 'ollama serve' or use a :cloud model"
```

If local Ollama is unreachable, fall back to `glm-4.7:cloud` (default cloud alternative).

## Project Skills

Local skills in `.claude/skills/` — invoke with `/skill-name`:

| Skill | Purpose |
|-------|---------|
| `/create-migration` | Scaffold Supabase migration + pgTAP test with hard-won rules baked in |
| `/review` | Adversarial security review for PHI/RLS/auth code |
| `/plan-with-tests` | Write a test-first handoff plan for a subordinate agent (/ollama or subagent) |
| `/expo` | Expo/React Native patterns for the mobile app |
| `/mobile-ui` | Drive iOS Simulator: boot, launch Expo, deep-link routes, screenshot (visual UI investigation) |
| `/ollama` | Dispatch parallel tasks to local Ollama models (Opus/Sonnet stays as orchestrator) |
| `/session-end` | End-of-session cleanup: revise CLAUDE.md, save memory, check git status |
| `/supabase-types` | Regenerate TypeScript types from local Supabase after migrations |
| `/backlog-sync` | Reconcile BACKLOG.md against git log + open PRs; rewrite §0 status board; flag stale/unblocked rows. Run at session start, end, and daily. |
| `/dispatch` | **Canonical parallel-dispatch skill.** Two input modes: ad-hoc task list/table OR `--from-backlog` (reads `BACKLOG.md` §1 Ready rows). Picks the right execution mode (plain implementation vs. `/tdd-ship` discipline) per input. Sets up worktrees with symlinked node_modules, scope contracts, model routing, and applies the ~~Mergify~~ `queue` label by default (~~Mergify~~ owns the queue — `gh pr merge --auto` is a no-op here). Mirrors `/wave`'s "one skill, picks the right mode" shape. |
| `/backlog-dispatch` | Thin alias for `/dispatch --from-backlog`. Kept for muscle memory; new work should reach for `/dispatch` directly. |
| `/ship-story` | Single-story end-to-end (N=1 case of `/dispatch`): read BACKLOG row → branch → tests-first implement → push → PR → mark In review. |
| `/schema-dump` | Dump schema of named Postgres tables (columns, indexes, RLS policies) **before** writing any migration or seed SQL. Prevents the ON CONFLICT / renamed-column iteration thrash. |
| `/tdd-ship` | Strict red-green-refactor: agent writes failing tests first, iterates ≤5 times to green, then refactors. Escalates if stuck instead of hacking around. Invoked per-item by `/dispatch` in backlog mode. |
| `/worktree-subagents` | Canonical primitive: pre-flight checklist + worktree-with-symlinks setup + scope-contract template. `/dispatch` references this rather than re-stating the boilerplate. Use directly for hand-rolled parallel work that doesn't fit `/dispatch`. |
| `/routing-report` | Weekly analysis of `.claude/routing-metrics.jsonl` — model usage + block events + `routing.yaml` tuning suggestions. |

## Agents

Local agents in `.claude/agents/`:

- **rls-reviewer** — reviews RLS policies and pgTAP tests for PHI security gaps after writing migrations or `supabase/tests/` files; verdicts: "Safe to commit" or "Do not commit — [reason]"

## Active Hooks

Auto-runs on every Edit/Write (configured in `.claude/settings.json`):

| Hook | Trigger | What it does |
|------|---------|-------------|
| tsc | PostToolUse Edit/Write | `npx tsc --noEmit` in apps/web |
| ESLint | PostToolUse Edit/Write | `npx eslint --cache --quiet` in apps/web |
| Prettier | PostToolUse Edit/Write | Auto-formats `.ts/.tsx/.js/.jsx` |
| pgTAP | PostToolUse Edit/Write | `supabase test db` when auth/RLS/migration files change; prints hint to invoke `/ollama` on failure |
| `.env` guard | PreToolUse Edit/Write | Blocks edits to `.env*` files (allows `.env.example`) |
| Lock file guard | PreToolUse Edit/Write | Blocks edits to `pnpm-lock.yaml` and `package-lock.json` |
| supabaseAdmin guard | PreToolUse Edit/Write | Warns when editing files outside `server/` or `app/api/` that contain `supabaseAdmin` |
| PR security review reminder | PreToolUse Bash | Prints hint to run `/review` before `gh pr create` |
| main-branch commit block | PreToolUse Bash | **Hard-blocks** `git commit` on `main` unless `CLAUDE_ALLOW_MAIN_COMMIT=1` is set. Prevents subagents committing to main by accident. |
| route-model | PreToolUse Agent | Logs Agent dispatches to `.claude/routing-metrics.jsonl`; **blocks** Haiku with >6000-char prompts and Opus dispatched for mechanical work. Override: `CLAUDE_ALLOW_MODEL_MISMATCH=1`. |
| related-test | PostToolUse Edit/Write | After editing an `apps/web/*.{ts,tsx}` source file, runs the related `__tests__/<file>.test.tsx` (30s timeout). Silent on green, surfaces failures immediately. |

## MCP & Plugin Configuration

- MCP servers belong in `.mcp.json` at the repo root (or `~/.claude/mcp.json` for global), **not** in `settings.json` (which is for hooks/permissions only).
- User-level MCP config lives at `~/.claude/mcp.json`; project-scoped at `.mcp.json`. Claude Code merges both.
- To add a server: `claude mcp add <name> -- <command>` — don't hand-edit unless necessary.
- Verify presence: `claude mcp list`.

## Plugin Priority

1. **memsearch** — recall memory before exploring codebase
2. **context-mode** — `ctx_execute` for output >20 lines; never Bash/Read for analysis
3. **superpowers** — invoke matching skill before any response (includes `frontend-design`)
4. **/ollama** — dispatch parallel/mechanical/exploratory work to local or cloud Ollama models
5. **context7** — fetch live library docs before answering framework/API questions
6. **chrome-devtools-mcp** — browser debugging, LCP, a11y audits on live app
7. **commit-commands** — `/commit`, `/commit-push-pr` for all git commits
