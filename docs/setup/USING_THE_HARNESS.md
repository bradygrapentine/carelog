# Using the Claude Harness — Optimal Workflow Guide

This document explains how the full Claude Code harness works and how to get maximum value from it. Read this when starting a new session, onboarding to the project, or wondering why something isn't working as expected.

---

## What the Harness Is

The harness is the sum of everything that shapes Claude Code's behavior on this project:

- **CLAUDE.md files** — instruction sets loaded at session start
- **Skills** — loaded-on-demand behavior guides for specific task types
- **Plugins** — installed tools that extend Claude's capabilities (memsearch, superpowers, context-mode, frontend-design, ollama)
- **Hooks** — shell commands that fire automatically on tool events
- **Memory** — cross-session persistent context stored in `~/.claude/projects/.../memory/`

---

## Session Start Ritual

Every session, Claude should:

1. **Check memory** via `memsearch` before exploring the codebase — prior decisions, feedback, and project state are already indexed
2. **Load relevant CLAUDE.md** — the root `.claude/CLAUDE.md` is always loaded; app-level CLAUDE.md files apply when working in that subdirectory
3. **Identify the task type** — this determines which tool to use (see routing below)

The `SessionStart` hook fires a reminder to recall memory and observe the 350-token response cap.

---

## Task Routing

The most important decision is which system handles the work.

```
Is the task mechanical? (rename, format, <50 lines, single file, known pattern)
  → Continue.dev, or /ollama for bulk/parallel mechanical work

Is the task multi-file or architectural?
  → Claude Code (interactive session)

Are there 2+ independent subtasks with no shared state?
  → Parallel subagents (superpowers:dispatching-parallel-agents); prefer /ollama per subtask

Is it a security or design review?
  → /review skill (parallel subagents)
```

### Claude Code handles:
- Multi-file architecture and RLS/schema changes
- Plugin orchestration and skill invocation
- UI component design
- Writing plans for Continue.dev handoff
- Any task requiring judgment across the full codebase

### Continue.dev handles:
- Autocomplete and inline edits (<50 lines)
- Single-file refactors
- Writing tests to a known pattern
- Known-error debugging

### Parallel subagents + `/ollama` handle:
- 3+ independent subtasks that can run in parallel
- Batch test fixes (one prompt per failing file)
- Exploration: reading many files, enumerating matches, summarizing docs
- Known-pattern boilerplate in bulk

See `.claude/CLAUDE.md` "Ollama Dispatch" section for the full routing table.

---

## Skills — When to Invoke

Skills are loaded via the `Skill` tool before responding. If a skill might apply, invoke it. No exceptions.

| Skill | Invoke when |
|-------|-------------|
| `test` | Writing any pgTAP, Vitest, or Playwright tests |
| `review` | Adversarial security review (parallel subagents) |
| `plan-with-tests` | Building a Continue.dev handoff plan (use instead of writing-plans) |
| `ollama` | Dispatching mechanical/parallel subtasks to local models |
| `superpowers:writing-plans` | Building a superpowers-style plan for subagent execution |
| `superpowers:brainstorming` | Starting any new feature — before touching code |
| `superpowers:dispatching-parallel-agents` | 2+ independent failures or tasks with no shared state |
| `superpowers:systematic-debugging` | Any bug or unexpected test failure |
| `superpowers:verification-before-completion` | Before claiming anything is done or passing |
| `superpowers:test-driven-development` | Implementing any feature or bugfix |
| `frontend-design:frontend-design` | Building UI components or pages (explicit design request only) |
| `expo` | Working in `apps/mobile/` — navigation, auth, styling, tRPC, testing patterns |

**Plugin priority order** (from CLAUDE.md):
1. memsearch — recall before exploring
2. context-mode — sandbox large outputs
3. superpowers — invoke matching skill first
4. frontend-design — explicit UI requests only
5. ollama — primary dispatch backend for parallel/mechanical subtasks

---

## Parallel Subagents & `/ollama` Dispatch

Parallel subagents via `superpowers:dispatching-parallel-agents` are the primary background-work mechanism. Use `/ollama` for local model dispatch on mechanical or exploratory subtasks; Claude Code stays as the orchestrator.

### Routing

| Task | Use |
|------|-----|
| Failing tests (batch fix) | `/ollama` with a fix prompt per file |
| Security/RLS review | `/review` skill (parallel subagents) |
| Multi-file architecture | Claude Code (this agent) |
| Parallel boilerplate / exploration | `/ollama` |
| Known-pattern code gen in bulk | `/ollama` with `qwen3-coder` |
| Plan implementation check | Task subagent: diff HEAD against plan file in `docs/superpowers/plans/` |
| Investigation spanning many files | Task subagent, or `/ollama` for scoped mechanical reads |

### Background vs foreground
- Long-running parallel dispatches: run in background, synthesize when they return
- Tight-loop fixes (test fixtures, lint errors): foreground, iterate

---

## The plan-with-tests Workflow

For any multi-step feature handed off to Continue.dev:

1. Invoke `plan-with-tests` skill
2. Read the spec/task
3. Write minimal failing tests for each step's flows (happy path, error cases, auth boundaries)
4. Run `pnpm test` to confirm tests **fail** before committing
5. Commit the failing tests: Continue.dev starts with a red suite
6. Generate the JSON plan with `description`, `files`, `verify`, and `do_not` for each step
7. Paste the JSON plan + handoff prompt into Continue.dev

The `verify.passes_when` strings must exactly match test names as they appear in Vitest output.

---

## Parallel Work

When facing 2+ independent problems (different files, different subsystems, no shared state), dispatch parallel agents using the `superpowers:dispatching-parallel-agents` skill. Prefer `/ollama` for mechanical per-file work.

Each agent gets:
- Specific scope (one file or subsystem)
- Clear goal (make these tests pass / implement this component)
- Explicit constraints (do not touch X)
- Expected output format

**Limits:** Max 2 background Task subagents per session (CLAUDE.md). Prefer foreground for tasks whose output informs the next step. `/ollama` dispatches scale higher since they run locally.

---

## Hooks — What Fires Automatically

### Project-level (`.claude/settings.json`)
- **PostToolUse on Edit/Write** → runs `npx tsc --noEmit` and `npx eslint --cache --quiet` in `apps/web` and surfaces the first errors. Also runs Prettier. Fires on every file edit — no need to run typecheck or lint manually during implementation.
- **PostToolUse on Edit/Write for RLS/migration files** → runs `supabase test db`. On failure, prints an `/ollama` dispatch hint so you can batch-fix failing pgTAP files in parallel.
- **Stop** → prompts Claude to write a session summary to the project memory file before the session ends.
- **PreToolUse on Bash** → parses Bash commands for destructive patterns (`rm -rf`, `git reset --hard`, `git push --force`, `DROP TABLE`, `git branch -D`, `git clean -f`). Injects a confirmation reminder if matched.

### Global (`~/.claude/settings.json`)
- **PreCompact** → reminds Claude to save key decisions to memory and check context-mode stats before compacting
- **SessionStart** → reminds Claude to recall memory via memsearch and observe the 350-token cap

---

## Memory System

Memory persists across sessions at `~/.claude/projects/.../memory/`. There are four types:

| Type | What it captures |
|------|-----------------|
| `user` | Role, preferences, expertise level |
| `feedback` | Corrections and confirmed approaches ("don't do X", "this worked") |
| `project` | Ongoing work, decisions, deadlines, rationale |
| `reference` | Where to find things in external systems |

**What not to save:** code patterns, file paths, git history, debugging recipes — these are derivable from the codebase. Save the *why* and the *preference*, not the *what*.

To recall explicitly: the `memsearch` plugin searches memory by semantic query before Claude explores the codebase.

---

## Context Pressure Management

When approaching the context limit:

1. Run `/compact` — compresses the conversation; memory and context-mode knowledge base are preserved
2. Save key decisions to memory before compacting (the `PreCompact` hook reminds you)
3. After compacting, recall memory at the start of the next session to restore context

### Self-check signals (from CLAUDE.md)
- Response likely >400 tokens → use JSON instead of prose
- Reading a 3rd file in a row for analysis → switch to `ctx_execute_file`
- Task is purely mechanical → route to Continue.dev or `/ollama`
- Approaching session end → run `/compact`, save key decisions to memory

---

## Token Discipline

- **Response cap: ≤350 tokens** unless the user asks for more
- Implementation tasks: output a plan, then "→ Implement in Continue.dev"
- Use JSON over prose when responses would be long
- Never restate what the user said — act on it

---

## MCP Servers

Three MCP servers are configured globally (`~/.claude/settings.json`):

### Playwright (`@playwright/mcp`)
Gives Claude a real browser. Use when:
- Verifying visual output of a component without writing a Playwright test
- Debugging e2e failures that are hard to reproduce from test output alone
- Checking a redirect flow or modal behavior interactively

Claude can click, type, screenshot, and navigate. Start the app first (`pnpm web`), then ask Claude to open `localhost:3000`.

### Supabase Local (`@modelcontextprotocol/server-postgres`)
Direct SQL against the local Supabase instance at `postgresql://postgres:postgres@localhost:54322/postgres`. Use when:
- Verifying an RLS policy is working as expected without writing pgTAP
- Inspecting schema or running a migration manually
- Checking what rows a specific role can see

Requires `supabase start` to be running first.

### GitHub (`@modelcontextprotocol/server-github`)
Requires `GITHUB_PERSONAL_ACCESS_TOKEN` set in your shell environment. Use when:
- Creating or reviewing PRs without leaving the session
- Checking CI status on a branch
- Pulling issue context into a session

**Setup:** Add to your shell profile:
```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here
```
Generate at: GitHub → Settings → Developer settings → Personal access tokens (fine-grained, `repo` + `pull_requests` scopes).

### Sentry (`@sentry/mcp-server`)
Requires `SENTRY_AUTH_TOKEN` and `SENTRY_ORG` set in shell environment. Dormant until Sentry account is configured for the project (pre-launch task). Once active, use when:
- A Sentry alert fires — paste the issue ID and Claude pulls the full stack trace, breadcrumbs, affected users, and first/last seen without leaving the session
- Investigating a production error by issue ID or DSN project

**Setup:** Add to `~/.zshrc`:
```bash
export SENTRY_AUTH_TOKEN=your_token_here
export SENTRY_ORG=your_org_slug_here
```
Generate token at: Sentry → Settings → Auth Tokens (scopes: `org:read`, `project:read`, `event:read`).

---

## Web Search

Claude can use `WebSearch` and `WebFetch` directly in any session. Use when:
- Looking up a library's changelog or breaking changes before upgrading
- Checking current Supabase/Next.js documentation for a specific feature
- Researching a CVE or security advisory
- Finding the correct API signature for a package you haven't used before

You don't need to leave the session or open a browser — just ask Claude to search or fetch a URL. Prefer this over guessing at API shapes from memory.

---

## Worktree Subagents

Use the `worktree-subagents` skill when parallel agents would otherwise edit the same files. The pattern:

1. `git worktree add .worktrees/<name> origin/main` — one per agent
2. Dispatch agents with their worktree as working directory and explicit `do not touch` scope
3. Review each diff independently, then integrate into main
4. `git worktree remove .worktrees/<name>` to clean up

**When worktrees are needed:** API route + RLS migration in parallel, mobile + web in parallel, any two agents whose scopes touch overlapping files.

**When plain parallel agents work:** Completely different file trees (e.g. component tests vs. schema types), read-only investigation agents.

See `.claude/skills/worktree-subagents/SKILL.md` for the full pattern with exact commands.

---

## Quick Reference

```
New feature idea                  → superpowers:brainstorming → plan-with-tests → Continue.dev
Failing tests (batch)             → /ollama with fix prompt per file
Security audit                    → /review skill (parallel subagents)
Design review / challenge         → /review skill
Implementation check vs plan      → Task subagent: diff HEAD vs docs/superpowers/plans/<file>
Multi-layer architectural change  → Parallel Agent tool calls (superpowers:dispatching-parallel-agents)
Bug / unexpected behavior         → superpowers:systematic-debugging
Writing tests                     → test skill
Before claiming done              → superpowers:verification-before-completion
```
