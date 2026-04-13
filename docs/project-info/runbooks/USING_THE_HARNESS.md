# Using the Claude Harness — Workflow Guide

How to get maximum value from the harness day-to-day. Read this at session start or when something isn't working as expected.
For what's configured and how to extend it, see `docs/setup/HARNESS.md`.

---

## What the Harness Is

The harness is the sum of everything shaping Claude Code's behavior on this project:

- **CLAUDE.md files** — instruction sets loaded at session start
- **Skills** — loaded-on-demand behavior guides for specific task types
- **Plugins** — tools extending Claude's capabilities (memsearch, superpowers, context-mode, ollama)
- **Hooks** — shell commands that fire automatically on tool events (typecheck, lint, pgTAP, guards)
- **Memory** — cross-session context stored in `~/.claude/projects/.../memory/`

---

## Session Start

Every session, Claude should:

1. **Check memory** via `memsearch` — prior decisions, feedback, and project state are already indexed
2. **Load relevant CLAUDE.md** — root `.claude/CLAUDE.md` is always loaded; app-level CLAUDE.md applies when working in that subdirectory
3. **Identify the task type** — determines which tool handles the work (see routing below)

The `SessionStart` hook fires a reminder to recall memory and observe the 350-token response cap.

---

## Task Routing

```
Mechanical? (rename, format, <50 lines, single file, known pattern)
  → /ollama

Multi-file or architectural?
  → Claude Code (this session)

2+ independent subtasks, no shared state?
  → Parallel subagents (superpowers:dispatching-parallel-agents); prefer /ollama per subtask

Security or design review?
  → /review skill (parallel subagents)
```

**Claude Code handles:** multi-file architecture, RLS/schema changes, plugin orchestration, UI component design, writing plans for handoff, any task requiring judgment across the full codebase.

**Parallel subagents + `/ollama` handle:** 3+ independent subtasks, batch test fixes (one prompt per failing file), codebase exploration, known-pattern boilerplate in bulk.

See `.claude/CLAUDE.md` "Ollama Dispatch" for the complete routing table.

---

## Skills — When to Invoke

Invoke via the `Skill` tool before responding. If a skill might apply, invoke it — no exceptions.

| Skill | Invoke when |
|-------|-------------|
| `test` | Writing any pgTAP, Vitest, or Playwright tests |
| `review` | Adversarial security review (PHI, RLS, auth, IDOR) |
| `plan-with-tests` | Building a TODO handoff plan with failing tests first |
| `ollama` | Dispatching mechanical/parallel subtasks to local models |
| `expo` | Working in `apps/mobile/` — navigation, auth, NativeWind, tRPC, testing |
| `superpowers:writing-plans` | Building a superpowers-style plan for subagent execution |
| `superpowers:brainstorming` | Starting any new feature — before touching code |
| `superpowers:dispatching-parallel-agents` | 2+ independent failures or tasks with no shared state |
| `superpowers:systematic-debugging` | Any bug or unexpected test failure |
| `superpowers:verification-before-completion` | Before claiming anything is done or passing |
| `superpowers:test-driven-development` | Implementing any feature or bugfix |
| `frontend-design:frontend-design` | Building UI components or pages (explicit design request only) |

**Plugin priority order:**
1. memsearch — recall before exploring codebase
2. context-mode — sandbox large command outputs
3. superpowers — invoke matching skill first
4. ollama — primary dispatch backend for parallel/mechanical subtasks

---

## Parallel Subagents & `/ollama` Dispatch

Parallel subagents via `superpowers:dispatching-parallel-agents` are the primary background-work mechanism. Use `/ollama` for mechanical or exploratory subtasks; Claude Code stays as orchestrator.

| Task | Use |
|------|-----|
| Failing tests (batch fix) | `/ollama` with a fix prompt per file |
| Security/RLS review | `/review` skill (parallel subagents) |
| Multi-file architecture | Claude Code (this session) |
| Parallel boilerplate / exploration | `/ollama` |
| Known-pattern code gen in bulk | `/ollama` with `qwen3-coder` |
| Plan implementation check | Task subagent: diff HEAD against `docs/superpowers/plans/<file>` |
| Investigation spanning many files | Task subagent or `/ollama` for scoped mechanical reads |

**Background vs foreground:**
- Long-running parallel dispatches → run in background, synthesize when they return
- Tight-loop fixes (test fixtures, lint errors) → foreground, iterate

**Limits:** Max 2 background Task subagents per session (per CLAUDE.md). `/ollama` dispatches scale higher since they run locally.

---

## The `plan-with-tests` Workflow

For any multi-step feature handed off to a subagent or `/ollama`:

1. Invoke `plan-with-tests` skill
2. Read the spec/task
3. Write minimal failing tests for each step (happy path, error cases, auth boundaries)
4. Run `pnpm test` to confirm tests **fail** before committing
5. Commit the failing tests — the subagent starts with a red suite
6. Generate the JSON plan with `description`, `files`, `verify`, and `do_not` for each step
7. Paste the plan + handoff prompt into the subagent

The `verify.passes_when` strings must exactly match test names as they appear in Vitest output.

---

## Hooks — What Fires Automatically

### Project-level (`.claude/settings.json`)

- **PostToolUse Edit/Write** → runs `npx tsc --noEmit` and `npx eslint --cache --quiet` in `apps/web` after every file edit. Also runs Prettier. No need to run typecheck or lint manually during implementation.
- **PostToolUse on RLS/migration files** → runs `supabase test db`. On failure, prints an `/ollama` dispatch hint so you can batch-fix failing pgTAP files in parallel.
- **PreToolUse guards** → block edits to `.env*`, lock files, and `apps/mobile/ios/`; warn on `supabaseAdmin` outside server directories; remind to run `/review` before `gh pr create`.

### Global (`~/.claude/settings.json`)

- **PreCompact** → reminds Claude to save key decisions to memory and check context-mode stats before compacting
- **SessionStart** → reminds Claude to recall memory via memsearch and observe the 350-token cap

See `docs/setup/HARNESS.md` for the full hook list with exact triggers and the extension guide.

---

## Memory System

Persists across sessions at `~/.claude/projects/.../memory/`.

| Type | What it captures |
|------|-----------------|
| `user` | Role, preferences, expertise level |
| `feedback` | Corrections and confirmed approaches ("don't do X", "this worked") |
| `project` | Ongoing work, decisions, deadlines, rationale |
| `reference` | Where to find things in external systems |

**What not to save:** code patterns, file paths, git history, debugging recipes — these are derivable from the codebase. Save the *why* and the *preference*, not the *what*.

To recall explicitly: the `memsearch` plugin searches memory by semantic query before Claude explores the codebase.

---

## Context Pressure

When approaching the context limit:

1. Run `/compact` — compresses the conversation; memory and context-mode knowledge base are preserved
2. Save key decisions to memory before compacting (the `PreCompact` hook reminds you)
3. After compacting, recall memory at session start to restore context

**Self-check signals:**
- Response likely >400 tokens → use JSON instead of prose
- Reading a 3rd file in a row for analysis → switch to `ctx_execute_file`
- Task is purely mechanical → route to `/ollama`
- Approaching session end → `/compact`, save key decisions to memory

---

## Token Discipline

- **Response cap: ≤350 tokens** unless the user asks for more
- Implementation tasks → output a plan, then "→ Implement with ollama"
- Use JSON over prose for long responses
- Never restate what the user said — act on it

---

## MCP Servers

### Playwright (`@playwright/mcp`)

Gives Claude a real browser. Use when:
- Verifying visual output without writing a Playwright test
- Debugging e2e failures that are hard to reproduce from test output alone
- Checking a redirect flow or modal behavior interactively

Start the app first (`pnpm web`), then ask Claude to open `localhost:3000`.

### Supabase Local (`@modelcontextprotocol/server-postgres`)

Direct SQL against `postgresql://postgres:postgres@localhost:54322/postgres`. Use when:
- Verifying an RLS policy without writing pgTAP
- Inspecting schema or running a migration manually
- Checking what rows a specific role can see

Requires `supabase start`.

### GitHub (`@modelcontextprotocol/server-github`)

Requires `GITHUB_PERSONAL_ACCESS_TOKEN` in your shell. Use when:
- Creating or reviewing PRs without leaving the session
- Checking CI status on a branch
- Pulling issue context into a session

```bash
# Add to shell profile
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here
```

Generate at: GitHub → Settings → Developer settings → Personal access tokens (fine-grained, `repo` + `pull_requests` scopes).

### Sentry (`@sentry/mcp-server`)

Dormant until Sentry account is configured (pre-launch task). Once active:
- Paste a Sentry issue ID and Claude pulls the full stack trace, breadcrumbs, affected users, and first/last seen without leaving the session

```bash
# Add to ~/.zshrc
export SENTRY_AUTH_TOKEN=your_token_here
export SENTRY_ORG=your_org_slug_here
```

Generate token at: Sentry → Settings → Auth Tokens (scopes: `org:read`, `project:read`, `event:read`).

---

## Web Search

Claude can use `WebSearch` and `WebFetch` in any session. Use when:
- Looking up a library's changelog or breaking changes before upgrading
- Checking current Supabase/Next.js docs for a specific feature
- Researching a CVE or security advisory
- Finding the correct API signature for a package not yet used

No need to leave the session or open a browser.

---

## Worktree Subagents

Use the `worktree-subagents` skill when parallel agents would otherwise edit the same files:

1. `git worktree add .worktrees/<name> origin/main` — one per agent
2. Dispatch agents with their worktree as working directory and explicit `do not touch` scope
3. Review each diff independently, then integrate into main
4. `git worktree remove .worktrees/<name>` to clean up

**When worktrees are needed:** API route + RLS migration in parallel, mobile + web in parallel, any two agents whose scopes touch overlapping files.

**When plain parallel agents suffice:** Completely different file trees (e.g. component tests vs. schema types), read-only investigation.

| Scenario | Agent 1 scope | Agent 2 scope |
|----------|-------------|-------------|
| New API + RLS policy | `apps/web/app/api/` | `supabase/migrations/` + `supabase/tests/` |
| Web feature + mobile | `apps/web/` | `apps/mobile/` |
| Docs + harness | `docs/` | `.claude/settings.json` |

---

## Quick Reference

```
New feature idea              → superpowers:brainstorming → plan-with-tests → subagent/ollama
Failing tests (batch)         → /ollama with fix prompt per file
Security audit                → /review skill (parallel subagents)
Implementation check vs plan  → Task subagent: diff HEAD vs docs/superpowers/plans/<file>
Multi-layer architectural work → superpowers:dispatching-parallel-agents
Bug / unexpected behavior      → superpowers:systematic-debugging
Writing tests                  → test skill
Before claiming done           → superpowers:verification-before-completion
Mobile feature                 → expo skill
New migration + RLS + pgTAP    → /create-migration skill
```
