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
  → /ollama for bulk/parallel mechanical work

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
- Writing plans for ollama handoff
- Any task requiring judgment across the full codebase


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
| `plan-with-tests` | Building a TODO handoff plan (use instead of writing-plans) |
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

For any multi-step feature handed off to TODO:

1. Invoke `plan-with-tests` skill
2. Read the spec/task
3. Write minimal failing tests for each step's flows (happy path, error cases, auth boundaries)
4. Run `pnpm test` to confirm tests **fail** before committing
5. Commit the failing tests: TODO starts with a red suite
6. Generate the JSON plan with `description`, `files`, `verify`, and `do_not` for each step
7. Paste the JSON plan + handoff prompt into TODO

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
- Task is purely mechanical → route to ollama agents
- Approaching session end → run `/compact`, save key decisions to memory

---

## Token Discipline

- **Response cap: ≤350 tokens** unless the user asks for more
- Implementation tasks: output a plan, then "→ Implement with ollama"
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
New feature idea                  → superpowers:brainstorming → plan-with-tests → TODO
Failing tests (batch)             → /ollama with fix prompt per file
Security audit                    → /review skill (parallel subagents)
Design review / challenge         → /review skill
Implementation check vs plan      → Task subagent: diff HEAD vs docs/superpowers/plans/<file>
Multi-layer architectural change  → Parallel Agent tool calls (superpowers:dispatching-parallel-agents)
Bug / unexpected behavior         → superpowers:systematic-debugging
Writing tests                     → test skill
Before claiming done              → superpowers:verification-before-completion
```
# Harness Usage — Debugging & Reference

A human-facing reference for Brady. What's actually running in this Claude Code session, how to tell when something silently fails, and how to audit what got loaded.

Complements `HARNESS.md` (which explains *what the harness is* and *how to extend it*). This doc is about *debugging* and *verification* — when things go wrong or you want to know whether a hook fired.

---

## 1. Overview

Claude Code here is configured via three surfaces:

| Surface | Location | Purpose |
|---------|----------|---------|
| `settings.json` | `.claude/settings.json` | Hooks (Pre/PostToolUse), permission allowlist |
| `CLAUDE.md` files | `.claude/CLAUDE.md`, `apps/*/CLAUDE.md`, `supabase/CLAUDE.md` | Instructions injected into every prompt |
| Plugins & skills | `~/.claude/plugins/cache/*`, `.claude/skills/*`, `.claude/agents/*` | Installed capabilities (MCP servers, skills, subagents) |

Every turn the model sees: `CLAUDE.md` contents + tool list + your message + recent memory hits. Hooks run out-of-band on specific tool calls.

---

## 2. Active Hooks

All hooks are in `.claude/settings.json`. To know if one fired, look for its prefix in terminal output (`[tsc]`, `[eslint]`, `[pgTAP]`, `[blocked]`, `[ollama]`, `[warn]`).

### PreToolUse (can block)

| Hook | Trigger | What to look for | Common failure |
|------|---------|------------------|----------------|
| PR security review hint | Bash matches `gh pr create` | `[ollama] Invoke /review skill (parallel subagents) before opening PR` | Hint only — no auto-dispatch; operator must invoke `/review` |
| Pre-commit changed tests | Bash matches `git commit` | Runs `pnpm -C apps/web exec vitest run --changed`; blocks on exit≠0 with `[blocked] Pre-commit test failures` | **See cautionary example below** |
| `.env` guard | Edit/Write to any `*.env*` (except `.env.example`) | `[blocked] .env edit rejected` | None — works reliably |
| Lock file guard | Edit/Write to `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock` | `[blocked] lock file edit rejected` | None |
| iOS prebuild guard | Edit/Write to `apps/mobile/ios/` (except `Info.plist`, entitlements, `CarelogWatch/`) | `[blocked] ios/ edit rejected` | None |
| `supabaseAdmin` warn | Edit/Write containing `supabaseAdmin` outside `server/`, `app/api/`, `supabase/` | `[warn] supabaseAdmin used outside ...` | Doesn't block — only prints |

### PostToolUse (diagnostic, never blocks)

| Hook | Trigger | Visible marker | How it silently fails |
|------|---------|----------------|-----------------------|
| Web tsc | Any Edit/Write | `[tsc] ...` errors, first 20 lines | If `apps/web` dir missing or tsc missing, silent |
| ESLint | Any Edit/Write | `[eslint] ...` first 15 lines | Cache corruption → no output even with real errors. Delete `apps/web/.eslintcache` |
| Prettier | `.ts/.tsx/.js/.jsx` Edit/Write | Silent on success | `\|\| true` swallows all errors — you won't know if it failed |
| Mobile tsc | Any Edit/Write to `apps/mobile/*.ts(x)` | tsc output, first 10 lines | Same as web |
| pgTAP autorun | Edit/Write to file path containing `auth`, `rls`, `migration`, `policy`, `supabase/tests` | `[pgTAP] Auth/RLS file changed — running supabase test db...` then last 20 lines; on failure prints `[ollama]` hint | Supabase not running → hangs or prints connection error. On failure, operator dispatches `/ollama` or parallel subagents to fix |
| shadcn import check | Edit/Write containing `@/components/ui/<name>` | `WARNING: ... does not exist. Run: pnpm dlx shadcn@latest add <name>` | Pattern is regex-narrow; misses namespaced imports |
| Card hint | `.tsx` with `bg-white border rounded-xl shadow` | `HINT: Raw card div detected` | Opens and reads the file — can race with fast edits |
| Sidebar breakpoint reminder | Edit/Write to sidebar/journal files without `md:` | `REMINDER: ... Verify md: breakpoint variants` | Heuristic — false positives common |

### Cautionary example — the `vitest --changed` pre-commit bug

The pre-commit hook runs `pnpm -C apps/web exec vitest run --changed`. `--changed` diffs against git HEAD, so **files already staged** are included but **files in other packages** (e.g., `apps/mobile/`, `packages/`) are **not covered** — vitest runs only from `apps/web`. A mobile-only change passes the gate trivially even if mobile tests are broken.

Symptom: commit succeeds, CI fails on mobile/packages tests.

Debug: run `pnpm -C apps/mobile exec vitest run --changed` manually before committing cross-package work. Better: extend the hook to detect path and run the correct workspace.

---

## 3. Plugins — actually used vs listed

Listed in `.claude/CLAUDE.md` under "Plugin Priority". Based on 42-session usage data:

| Plugin | Status | Notes |
|--------|--------|-------|
| `memsearch` | **Active** | Auto-runs recall on every turn — check `[memsearch] Memory available` marker |
| `context-mode` | **Active** | `ctx_execute`/`ctx_batch_execute` used heavily; Node version drift breaks it — run `/context-mode:ctx-upgrade` |
| `superpowers` | **Active** | Skills invoked automatically (brainstorming, writing-plans, TDD, etc.) |
| `superpowers:dispatching-parallel-agents` | **Active** | Primary pattern for background work — fan out subagents for independent tasks |
| `/ollama` | **Active** | Local model dispatch for mechanical, scoped subtasks (3+ independent units, bulk boilerplate) |
| `context7` | **Active** | Library doc lookup (React, Next.js, etc.) — used when framework questions arise |
| `chrome-devtools-mcp` | **Active** | LCP / a11y debugging on running web app |
| `commit-commands` | **Active** | `/commit`, `/commit-push-pr` are the standard commit path |
| `pr-review-toolkit` | **Listed, unused** | `/pr-review-toolkit:review-pr` exists but rarely invoked — consider pruning or actually using pre-merge |
| `claude-md-management` | **Listed, unused** | `/revise-claude-md` rarely fires — `/session-end` handles the same job |
| `sentry` MCP | **Listed, unused** | Tools available but no Sentry workflow yet — remove or wire it up |
| `github` MCP | **Listed, unused** | `gh` CLI is used instead — MCP tools are duplicative |
| `playwright` MCP | **Listed, rarely used** | E2E runs via `pnpm exec playwright test`, not MCP |
| `posthog` MCP | **Listed, unused** | Auth tool only |
| `supabase-local` MCP | **Occasional** | `query` tool — `psql` via Bash usually preferred |
| `ide` MCP | **Occasional** | `getDiagnostics` seldom helpful vs. tsc hook |

**Recommendation:** audit `~/.claude/plugins/*` and remove `sentry`, `posthog`, `github`, `pr-review-toolkit` unless you commit to using them. Each one loads tools into context.

**Parallel-subagent + ollama health check:** verify the local Ollama server is up before dispatching `/ollama`:

```bash
curl -sf http://localhost:11434/api/tags
```

If this fails, `/ollama` dispatch will silently stall. Start Ollama (`ollama serve`) and re-run.

---

## 4. Custom skills & agents

### Skills (`.claude/skills/`)

| Skill | Invoke when | Example trigger |
|-------|-------------|-----------------|
| `/create-migration` | New Supabase migration needed | "add a `flags` table" |
| `/frontend-design` | Designing production UI | "build a dashboard card" |
| `/review` | PHI/RLS/auth code complete | "review this before I merge" |
| `/test` | Writing Vitest or pgTAP | "add tests for X" |
| `/plan-with-tests` | TODO handoff | "write a plan for feature Y" |
| `/expo` | Mobile feature work | "add offline queue support" |
| `/worktree-subagents` | Parallel independent work | "split this into web + rls tasks" |
| `/session-end` | Closing a session | "wrap up" |
| `/supabase-types` | After a migration applied | "regen types" |
| `/deploy-autopilot` | Ship to prod | "deploy" |
| `/add-component` | Add shadcn component | "add a Select" |
| `/excalidraw-diagram` | Any diagram request | "draw the invite flow" |
| `/ollama` | Offload bulk parallel work to local | "fan out these 20 file summaries" |
| `/skill-builder` | Create/audit a skill | "make a new skill for X" |
| `/integration-nextjs-app-router` | Wire PostHog into Next.js | "add analytics" |

### Agent — `rls-reviewer` (`.claude/agents/rls-reviewer.md`)

Reviews RLS policies and pgTAP tests. Verdict is always **"Safe to commit"** or **"Do not commit — [reason]"**. Invoke after any migration or `supabase/tests/` change. Never bypass a negative verdict without fixing the cited issue.

---

## 5. Lessons From Production Use

These patterns burned real sessions. Memorize them.

### Subagent scope drift

**What happened:** Dispatched subagents added unrelated features (e.g. search to MedicationPanel), leaked PHI into `posthog.identify()`, and committed to the wrong branch — all requiring reverts and cherry-picks.

**Prevention:** Every subagent dispatch needs an explicit scope contract (see CLAUDE.md § Subagent Scope Contract). Include: files allowed, target branch, PHI rule, and a "do not touch" clause. A subagent without a scope contract is a liability.

### Exploring instead of delivering

**What happened:** Review requests, runbook creation, and coverage gap analyses all stalled when Claude read files instead of producing output. Sessions hit rate limits without any artifact produced.

**Prevention:** The first action for any artifact request (review, runbook, tests) is to create the output file with section headers. Then fill it section by section. "I need to understand the codebase first" = output will never come. Start the file, then read what each section needs.

### Environment blockers mid-session

**What happened:** Docker not running, wrong branch, IDE file-watcher reverting staged files — all discovered mid-task after significant context was spent.

**Prevention:** Run a pre-flight before any multi-step session:
```bash
git branch --show-current && git status && docker ps | grep supabase | head -3
```
If Supabase is needed for the task and Docker shows no Supabase containers, stop and `supabase start` before doing anything else.

---

## 6. Common silent failure modes

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `ctx_execute` returns nothing or "Node version mismatch" | context-mode binary compiled against different Node | `/context-mode:ctx-upgrade` then `/context-mode:ctx-doctor` |
| A hook I expected didn't fire | File path didn't match the hook's `matcher` or gate, or `|| true` swallowed the error | Check `.claude/settings.json`; run the hook command manually with a fake JSON stdin |
| Subagent committed to `main` instead of feature branch | Subagent wasn't told explicit branch | Always pass branch name in the dispatch prompt: "Commit on branch `feature/X`. Run `git branch --show-current` first." |
| `/ollama` dispatch stalls silently | Local Ollama server not running | `curl -sf http://localhost:11434/api/tags`; if it fails, run `ollama serve` and re-dispatch |
| Parallel subagents didn't fan out | Skill not invoked — orchestrator tried to do the work serially | Explicitly invoke `superpowers:dispatching-parallel-agents` or `/ollama` with per-task scope |
| Prettier "didn't format" | Hook `|| true` hides errors | Run `npx prettier --write <file>` manually |
| pgTAP hook ran forever | Supabase not started | `supabase start`, then redo the edit |
| `[tsc]` showed errors you didn't cause | Stale build state from another branch | `rm -rf apps/web/.next apps/web/tsconfig.tsbuildinfo` |
| Model ignored your instruction | CLAUDE.md not loaded (wrong cwd) or instruction buried | Verify cwd with `pwd`; short instructions in CLAUDE.md stick better than long ones |
| ESLint silent on real errors | `.eslintcache` corrupt | `rm apps/web/.eslintcache` |
| PR security review hint didn't fire | Matcher only fires on **literal** `gh pr create` in a Bash tool — not `/commit-push-pr` | Run `gh pr create` explicitly, or invoke `/review` skill manually before opening the PR |

---

## 7. Debugging checklist

When something feels off:

1. **Hook fired?** Search terminal scrollback for the hook's prefix (`[tsc]`, `[pgTAP]`, `[blocked]`, `[ollama]`, `[warn]`). No prefix = didn't fire.
2. **Validate settings.json:** `python3 -c "import json; json.load(open('.claude/settings.json'))" && echo valid`
3. **Run the hook manually:** pipe synthetic JSON to the hook's command:
   ```bash
   echo '{"tool_input":{"file_path":"apps/web/foo.ts","content":""}}' | bash -c '<hook command here>'
   ```
4. **Check loaded memory:** the `[memsearch] Memory available` banner lists files — open `~/.claude/projects/-Users-bradygrapentine-Documents-projects-carelog/memory/MEMORY.md`.
5. **Audit context-mode knowledge base:** `/context-mode:ctx-stats` shows what's indexed and savings ratio.
6. **Verify branch before commit:** `git branch --show-current`. Always. Especially after subagent work.
7. **What's actually in context?** Scroll up in Claude Code and find the system-reminder blocks — they enumerate CLAUDE.md paths, skills, and MCP tools currently loaded. If something is missing, the harness didn't load it.
8. **Is a skill stale?** `.claude/skills/<name>/SKILL.md` — open and read the trigger description. Skills only auto-invoke when user intent matches.
9. **Permission denials:** if Bash refuses a command, the pattern isn't in `permissions.allow` in `settings.json` — either add it or run interactively.

---

## See also

- `docs/project-info/runbooks/HARNESS.md` — how to extend the harness, hook syntax reference, worktree patterns
- `.claude/settings.json` — ground truth for hooks and permissions
- `.claude/CLAUDE.md` — plugin priority, routing, code style rules
