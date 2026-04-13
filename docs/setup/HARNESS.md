# Claude Code Harness Map

## Entry Points

| File | Scope | Purpose |
|------|-------|---------|
| `.claude/CLAUDE.md` | Project root | Master config — workflow, code style, plan mode, plugin priority, token discipline |
| `apps/web/CLAUDE.md` | Next.js app | Next.js 16 breaking changes, Turbopack rules, auth pattern, service role boundary |
| `apps/web/AGENTS.md` | Next.js app | Same rules in agent-compatible format (async params, proxy.ts, Turbopack) |
| `apps/mobile/CLAUDE.md` | Expo app | Offline queue, env vars, auth pattern |

## Skills

| Skill | Path | Purpose |
|-------|------|---------|
| `test` | `.claude/skills/test/SKILL.md` | pgTAP fixtures, Vitest patterns, Playwright helpers, Zod rules |
| `review` | `.claude/skills/review/SKILL.md` | Adversarial security review — PHI leakage, IDOR, RLS, invite TOCTOU |
| `plan-with-tests` | `.claude/skills/plan-with-tests/SKILL.md` | ollama handoff plans with TDD verify steps |
| `worktree-subagents` | `.claude/skills/worktree-subagents/SKILL.md` | Parallel subagents with isolated file state via git worktrees |
| `ollama` | `.claude/skills/ollama/SKILL.md` | Dispatch parallel tasks to local Ollama models |
| `expo` | `.claude/skills/expo/SKILL.md` | Expo/React Native patterns for `apps/mobile/` — navigation, auth, styling, tRPC, testing |

## Parallel Subagents & Ollama Dispatch

Parallel subagents via `superpowers:dispatching-parallel-agents` are the primary background-work mechanism. Use `/ollama` for local model dispatch on mechanical/exploratory subtasks; keep Claude Code as the orchestrator.

| Task | Use |
|------|-----|
| Failing tests (batch fix) | `/ollama` with fix prompts per file |
| Security/RLS review | `/review` skill (parallel subagents) |
| Multi-file architecture | Claude Code (this agent) |
| Parallel boilerplate / exploration | `/ollama` |
| Known-pattern code gen in bulk | `/ollama` with `qwen3-coder` |
| Plan implementation check | Task subagent: diff HEAD vs `docs/superpowers/plans/<file>` |
| Migration + pgTAP scaffold | `/create-migration` |

## Reference Docs (load on demand)

Linked from `.claude/CLAUDE.md`:

| Doc | Purpose |
|-----|---------|
| `docs/project-info/technology/ARCHITECTURE.md` | Data model, system design, design rationale |
| `docs/project-info/technology/CODE_STANDARDS.md` | Hard-won coding rules, conventions, testing patterns, git format |
| `docs/project-info/product/UX_DECISIONS.md` | Language, tone, emotional framing decisions |
| `docs/project-info/technology/TECH_DEBT.md` | Known issues before production |
| `docs/project-info/product/BUILD_STATUS.md` | What's done / in progress / next |
| `docs/project-info/technology/TROUBLESHOOTING.md` | Local dev fixes (Supabase, auth, Turbopack) |

## MCP Servers

| Server | Package | Purpose |
|--------|---------|---------|
| `playwright` | `@playwright/mcp` | Browser automation — drive the app visually during e2e testing |
| `supabase-local` | `@modelcontextprotocol/server-postgres` | Direct SQL access to local Supabase (port 54322) |
| `github` | `@modelcontextprotocol/server-github` | PRs, issues, CI status — requires `GITHUB_PERSONAL_ACCESS_TOKEN` env var |
| `sentry` | `@sentry/mcp-server` | Pull Sentry issues and stack traces in-session — requires `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` env vars; dormant until Sentry account configured |

## Workflow Guide

| Doc | Purpose |
|-----|---------|
| `docs/project-info/claude/USING_THE_HARNESS.md` | **Start here** — task routing, skill invocation, parallel-subagent dispatch, hooks, memory, token discipline |

## Additional Docs (not auto-loaded)

| Doc | Purpose |
|-----|---------|
| `docs/project-info/product/OVERVIEW.md` | Three-tier architecture diagram, client decision tree |
| `docs/project-info/technology/AUTH_FLOW.md` | OTP flow, invite acceptance flow, session storage by layer |
| `docs/project-info/technology/DATA_FLOW.md` | Care event write/read paths, identity resolution, invite paths |
| `docs/project-info/technology/SECURITY_MODEL.md` | PHI boundary, service role isolation, RLS design, invite token security |
| `docs/project-info/technology/INFRASTRUCTURE.md` | Why each third-party service was chosen |
| `docs/project-info/claude/AGENT_WORKFLOW.md` | Agent and session workflow |
| `docs/project-info/runbooks/DEPLOY.md` | Production deploy guide |
| `docs/project-info/runbooks/MANUAL_TESTING.md` | QA testing for live website (web + mobile) |
| `docs/project-info/runbooks/THIRD_PARTY_SETUP.md` | External services, accounts, and infrastructure |
| `docs/project-info/runbooks/CODEBASE_EDUCATION.md` | Documentation reading path for new contributors |
| `docs/project-info/product/PRODUCT_STRATEGY.md` | Product and business strategy |
| `docs/project-info/product/ROADMAP.md` | Product roadmap |
| `docs/project-info/product/BACKLOG_PHASE2.md` | Phase 2 backlog items |

# Carelog — Developer Harness Guide

Everything the harness does automatically, how to use it deliberately, and how to extend it.

---

## What the Harness Is

The Claude Code harness is a set of hooks, local skills, agents, and parallel-subagent dispatch patterns that run automatically as you work. It enforces code quality, prevents common mistakes, and routes work to the right tool without requiring you to remember checklists.

**Core principle:** The harness catches things before they become bugs. Read this guide so you know what's running and why.

---

## Automated Hooks

Hooks run on every file write. They are configured in `.claude/settings.json`.

### PreToolUse Hooks (run before writes)

These block writes that would cause problems.

| Hook | Trigger | What it does |
|------|---------|-------------|
| `.env` guard | Any Edit/Write | Blocks edits to `.env*` files (allows `.env.example`) |
| Lock file guard | Any Edit/Write | Blocks edits to `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock` |
| iOS prebuild guard | Any Edit/Write | Blocks direct edits to `apps/mobile/ios/` except `Info.plist`, `entitlements`, `CarelogWatch/` |
| `supabaseAdmin` warn | Any Edit/Write | Prints a warning if you write `supabaseAdmin` outside `server/` or `app/api/` |
| PR security review | `gh pr create` | Prints a hint to invoke `/review` skill (parallel subagents) before PR opens |

**Why each guard exists:**

- **`.env` guard** — Prevents accidentally committing secrets. If you need to add a real env var, set it directly in your shell or Vercel dashboard.
- **Lock file guard** — Lock files must be regenerated by the package manager, not hand-edited. Run `pnpm install` instead.
- **iOS prebuild guard** — `apps/mobile/ios/` is fully generated by `expo prebuild --clean`. Direct edits are silently overwritten on next prebuild. The guard surfaces this before the work is lost.
- **`supabaseAdmin` warn** — The admin client bypasses RLS. Accessing it outside server-trusted directories is a PHI boundary violation.

### PostToolUse Hooks (run after writes)

These validate and format code automatically.

| Hook | Files | What it does |
|------|-------|-------------|
| Web TypeScript check | Any file in `apps/web/` | Runs `npx tsc --noEmit` and prints first 20 errors |
| ESLint | Any file in `apps/web/` | Runs `npx eslint --cache --quiet` and prints first 15 warnings |
| Prettier | `.ts`, `.tsx`, `.js`, `.jsx` | Auto-formats the file in-place |
| Mobile TypeScript check | Any file in `apps/mobile/` | Runs `npx tsc --noEmit` in mobile, prints first 10 errors |
| pgTAP auto-run | Auth/RLS/migration files | Runs `supabase test db`; on failure, prints `/ollama` hint (see `.claude/settings.json`) |

**pgTAP trigger keywords** — any of these in the file path triggers pgTAP:
`auth`, `rls`, `migration`, `policy`, `supabase/tests`

---

## Local Skills

Invoke with `/skill-name` in Claude Code.

| Skill | Purpose |
|-------|---------|
| `/create-migration` | Scaffold a Supabase migration + pgTAP test with all hard-won rules baked in |
| `/frontend-design` | Design a production-grade UI component using the design system |
| `/review` | Adversarial security review: PHI leakage, IDOR, supabaseAdmin misuse, RLS gaps |
| `/test` | Write Vitest unit tests or pgTAP RLS tests following project patterns |
| `/plan-with-tests` | Write a TODO handoff plan (failing tests first, then implementation) |
| `/expo` | Expo/React Native patterns: NativeWind, SecureStore, offline queue, Expo Router |
| `/worktree-subagents` | Dispatch parallel Claude subagents with isolated git worktrees |
| `/session-end` | End-of-session cleanup: revise CLAUDE.md, save memory, check git status |
| `/supabase-types` | Regenerate TypeScript types from local Supabase after migrations |

**When to use which skill:**

- Writing a new migration → `/create-migration` first
- Designing a new screen or component → `/frontend-design`
- Touching auth, RLS, or `supabaseAdmin` → `/review` after you're done
- Starting a multi-file task → `/plan-with-tests` to create a handoff plan
- Mobile feature work → `/expo` for patterns

---

## Local Agents

Agents are sub-configurations with a specific scope and output format.

### `rls-reviewer`

Invoked automatically or on demand. Reviews RLS policies and pgTAP tests for PHI security gaps.

**Triggers:** After writing migrations or `supabase/tests/` files.

**Output format:** One of two verdicts:
- `Safe to commit` — no issues found
- `Do not commit — [reason]` — specific gap identified

Never bypass a "do not commit" verdict without explicitly fixing the cited issue.

---

## Parallel Subagent Dispatch

Parallel subagents via the `superpowers:dispatching-parallel-agents` skill handle background work. Prefer local `/ollama` dispatch for mechanical, scoped subtasks; Claude Code stays as the orchestrator.

### When parallel subagents run

- pgTAP hook fails → hook prints `/ollama` hint; dispatch parallel subagents to fix each failing test file (prefer `/ollama` for mechanical fixes)
- `gh pr create` detected → invoke `/review` skill (parallel subagents) for PHI/RLS/auth review
- Failing tests, stuck bugs, or multi-file work → spawn a Task subagent or dispatch `/ollama` for scoped work
- Comparing a diff against a plan file → dispatch a Task subagent to compare diff against `docs/superpowers/plans/<plan>.md`

### Ollama dispatch

Use `/ollama` for:

- 3+ independent mechanical tasks (bulk boilerplate, file enumeration, per-file summaries)
- Fan-out test repair across unrelated files
- Exploratory reads where speed matters more than depth

Claude Code remains the orchestrator and merges the results.

---

## Worktree Patterns

Use worktrees when two agents would otherwise edit overlapping files.

### Create a worktree

```bash
git worktree add .worktrees/<feature-name> origin/main
```

Always base on `origin/main`, not local main — avoids picking up uncommitted local changes.

### Dispatch scoped agents

```
Agent 1 — working directory: /path/to/project/.worktrees/feature-web
           scope: apps/web/app/api/invite/
           do not touch: supabase/, apps/mobile/

Agent 2 — working directory: /path/to/project/.worktrees/feature-rls
           scope: supabase/migrations/, supabase/tests/
           do not touch: apps/
```

### Review and integrate

```bash
git -C .worktrees/feature-web diff origin/main
git -C .worktrees/feature-rls diff origin/main

# Cherry-pick or merge
git cherry-pick <commit-sha>

# Run full suite after integration
pnpm test && supabase test db
```

### Cleanup

```bash
git worktree remove .worktrees/feature-web
git worktree remove .worktrees/feature-rls
# or all at once:
git worktree prune
```

`.worktrees/` is gitignored — worktrees don't appear in git status on main.

### Common splits

| Scenario | Agent 1 scope | Agent 2 scope |
|----------|-------------|-------------|
| New API + RLS policy | `apps/web/app/api/` | `supabase/migrations/` + `supabase/tests/` |
| Web feature + mobile | `apps/web/` | `apps/mobile/` |
| Docs + harness | `docs/` | `.claude/settings.json` |

---

## Proactive Dispatch Triggers

Dispatch parallel subagents (via `superpowers:dispatching-parallel-agents`) without being asked when:

- Test suite has >2 failures and root cause isn't obvious → fan out one subagent per failing file; prefer `/ollama` for mechanical fixes
- Task requires running code to verify a fix (not just reading) → spawn a Task subagent
- Security/RLS review needed before merging → invoke `/review` skill (parallel subagents)
- Implementation is stuck after 2 attempts → spawn a Task subagent with a fresh context, or dispatch `/ollama` for scoped work

---

## Routing Guide

| Task | Right tool |
|------|-----------|
| Failing tests | Dispatch parallel subagents via superpowers; prefer `/ollama` for mechanical fixes |
| Security/RLS review | `/review` skill (parallel subagents) |
| Multi-file implementation | Task subagent, or `/ollama` for scoped work |
| Diff vs plan file | Task subagent comparing diff against `docs/superpowers/plans/<plan>.md` |
| Quick inline edit (<50 lines) | TODO |
| Architecture / planning | Claude Code |
| Known-pattern boilerplate | TODO or `/create-migration` |
| New migration + RLS + pgTAP | `/create-migration` skill |
| Mobile feature | `/expo` skill → TODO handoff |
| Bulk parallel mechanical work | `/ollama` |

---

## Extending the Harness

### Add a new PostToolUse hook

Open `.claude/settings.json`. Add to the `PostToolUse > Edit|Write > hooks` array:

```json
{
  "type": "command",
  "command": "python3 -c \"import sys,json; d=json.load(sys.stdin); fp=d.get('tool_input',{}).get('file_path',''); exit(0 if '<trigger-pattern>' in fp else 1)\" 2>/dev/null && <your-command> || true"
}
```

The `python3 -c` block gates execution by file path. `|| true` ensures hook failures don't block writes.

### Add a new PreToolUse guard

```json
{
  "type": "command",
  "command": "python3 -c \"import sys,json; d=json.load(sys.stdin); fp=d.get('tool_input',{}).get('file_path',''); exit(1 if '<blocked-pattern>' in fp else 0)\" || (echo '[blocked] reason' && exit 2)"
}
```

Exit code 2 blocks the tool use entirely. Exit code 0 allows it.

### Add a new skill

Create `.claude/skills/<skill-name>/index.md`. Claude will pick it up automatically. Add an entry to the skills table in `.claude/CLAUDE.md`.

### Validate settings.json

```bash
python3 -c "import json; json.load(open('.claude/settings.json'))" && echo "valid"
```

---

## Verify the Harness Is Working

After making changes to `.claude/settings.json`:

1. Edit any `.ts` file in `apps/web/` — you should see `[tsc]` output if there are errors
2. Edit any `.ts` file in `apps/mobile/` — you should see mobile tsc output if there are errors
3. Edit a file with a path containing `migration` — you should see `[pgTAP] Auth/RLS file changed...`
4. Try to edit `.env.local` — it should be blocked with `[blocked] .env edit rejected`
5. Try to edit `pnpm-lock.yaml` — it should be blocked with `[blocked] lock file edit rejected`
