# Carelog

Family caregiving coordination platform. $14/mo family plan. Bootstrapped.
Monorepo: `apps/`, `packages/`, `supabase/`.

## Development Workflow

1. Make changes
2. `pnpm typecheck`
3. `pnpm test`
4. Before PR: `pnpm lint` + full test suite + `supabase test db`

## Commands

```sh
supabase start          # Must run first
pnpm web                # localhost:3000
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
pnpm test               # Vitest unit tests
supabase test db        # RLS pgTAP tests — see supabase/CLAUDE.md
pnpm exec playwright test  # E2E — see e2e/CLAUDE.md
```

## Code Style

- `type` over `interface`; no `enum` — use string literal unions
- Web-specific rules: see `apps/web/CLAUDE.md`
- Supabase/RLS rules: see `supabase/CLAUDE.md`

## Plan Mode

- Start every complex task (3+ files) in plan mode
- Pour energy into the plan → 1-shot implementation
- When something goes sideways, re-plan — don't keep pushing

## Branch Hygiene

- Always verify current branch with `git branch --show-current` before any commit
- When dispatching subagents, explicitly pass the target branch name and instruct them to verify it before committing
- Never commit directly to main/master without confirmation

## Parallel Work

- Subagents only for genuinely independent tasks (different files, no shared state)
- Max 2 background agents per session
- Worktrees: `git worktree add .worktrees/<name> origin/main`

## Automation & Sessions

- `/loop` — run a skill on a recurring interval
- `/schedule` — schedule Claude on a cron, up to a week
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

### Routing Guide

| Task | Use |
|------|-----|
| Failing tests (batch fix) | `/ollama` with fix prompts per file |
| Security/RLS review | `/review` skill |
| Multi-file architecture | Claude Code (this agent) |
| Parallel boilerplate / exploration | `/ollama` |
| Known-pattern code gen in bulk | `/ollama` with `qwen3-coder` |
| Migration + pgTAP scaffold | `/create-migration` |

### Health check before dispatch

```bash
curl -sf http://localhost:11434/api/tags > /dev/null && echo "ollama ok" || echo "ollama not running — start with 'ollama serve' or use a :cloud model"
```

If local Ollama is unreachable, fall back to `glm-4.7:cloud` (default cloud alternative).

## Headless Scripts

Run Claude non-interactively for automated QA:

| Script | Purpose |
|--------|---------|
| `./scripts/security-review.sh` | Adversarial security review → `reviews/YYYY-MM-DD-security-review.md` |
| `./scripts/build-fix.sh` | Self-correcting build loop (up to 5 fix cycles) |

## Reference Docs (load on demand)

- `docs/project-info/technology/ARCHITECTURE.md` — data model, system design, design rationale
- `docs/project-info/technology/CODE_STANDARDS.md` — hard-won coding rules, conventions, testing patterns, git format
- `docs/project-info/product/UX_DECISIONS.md` — language and tone rules
- `docs/project-info/technology/TECH_DEBT.md` — known issues before production
- `docs/project-info/product/BUILD_STATUS.md` — what's done / in progress / next
- `docs/project-info/technology/TROUBLESHOOTING.md` — local dev fixes (Supabase, auth, Turbopack)
- `docs/project-info/runbooks/HARNESS_USAGE.md` — how the Claude Code harness actually runs here; debugging silent hook failures
- `docs/project-info/runbooks/TOKEN_DISCIPLINE.md` — Ollama dispatch patterns, handoff plan format

## Things Claude Should NOT Do

- Don't use `any` type without explicit approval
- Don't auto-import large reference docs — list them, let user load on demand
- Don't claim done without running verification commands first
- Don't edit files during code review — only read and report findings

## Code Reviews

- When asked to perform a 'review' or 'adversarial review': ONLY read and analyze code. Do NOT edit files or make implementation changes unless explicitly asked to fix issues afterward.
- When the user confirms 'Yes' or similar affirmation: treat it as confirmation of the previously proposed action — not as answering a question.

## Adversarial Reviews

- When asked for a review, DO NOT edit files — produce review output only
- Prefer the `/review` skill (parallel subagents) over any single-agent review path
- If a dispatched review agent stalls or returns empty, report immediately rather than retrying silently

## General Rules

- When instructed to read docs or follow a specific document: read those files FIRST before exploring the codebase. Do not autonomously explore code when directed to consult documentation.
- Do not present option menus or ask clarifying questions when the user has given a clear, specific request. Execute directly. If the request names specific deliverables (e.g., 'create three runbooks'), produce them without stalling.

## Task Execution

- When the user requests specific named deliverables (e.g., "create these 3 runbooks"), produce them directly without option menus or clarifying questions unless truly blocked
- Read referenced docs FIRST before exploring the codebase

## Self-Improvement

After every correction: update this file immediately.
End corrections with: "Now update CLAUDE.md so you don't make that mistake again."

## Project Skills

Local skills in `.claude/skills/` — invoke with `/skill-name`:

| Skill | Purpose |
|-------|---------|
| `/create-migration` | Scaffold Supabase migration + pgTAP test with hard-won rules baked in |
| `/review` | Adversarial security review for PHI/RLS/auth code |
| `/plan-with-tests` | Write a test-first handoff plan for a subordinate agent (/ollama or subagent) |
| `/expo` | Expo/React Native patterns for the mobile app |
| `/worktree-subagents` | Dispatch parallel subagents with isolated file state |
| `/ollama` | Dispatch parallel tasks to local Ollama models (Opus/Sonnet stays as orchestrator) |
| `/session-end` | End-of-session cleanup: revise CLAUDE.md, save memory, check git status |
| `/supabase-types` | Regenerate TypeScript types from local Supabase after migrations |

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

## Plugin Priority

1. **memsearch** — recall memory before exploring codebase
2. **context-mode** — `ctx_execute` for output >20 lines; never Bash/Read for analysis
3. **superpowers** — invoke matching skill before any response (includes `frontend-design`)
4. **/ollama** — dispatch parallel/mechanical/exploratory work to local or cloud Ollama models
5. **context7** — fetch live library docs before answering framework/API questions
6. **chrome-devtools-mcp** — browser debugging, LCP, a11y audits on live app
7. **commit-commands** — `/commit`, `/commit-push-pr` for all git commits

## Token Discipline

- Response cap: ≤350 tokens unless the task demands more
- Mechanical work (boilerplate, single-file refactor, known-pattern tests, bulk exploration) → dispatch to `/ollama`
- 3+ independent subtasks → parallel fan-out via `/ollama` rather than serial Claude work
- Full routing, self-check signals, and handoff plan format: `docs/project-info/runbooks/TOKEN_DISCIPLINE.md`
