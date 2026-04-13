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

## Codex

Codex is a separate GPT-5.4-based agent with its own terminal. Default sandbox: `workspace-execute` (can run commands) with `--approval-policy confirm` (asks before each command).

### Commands

| Command | Purpose |
|---------|---------|
| `/codex:rescue [prompt]` | General-purpose: diagnosis, implementation, research |
| `/codex:fix-tests [--unit\|--rls\|--e2e\|--all]` | Fix failing tests; `--rls` runs `supabase test db` |
| `/codex:review` | Standard code review against local git state |
| `/codex:adversarial-review [focus]` | Challenges design choices — prefer `/review` skill instead (uses parallel subagents, more reliable) |
| `/codex:security-review` | PHI-boundary review — prefer `/review` skill instead |
| `/codex:plan-review [plan-file]` | Compare diff against plan in `docs/superpowers/plans/` |
| `/codex:status` | Check background job progress |
| `/codex:result [job-id]` | Fetch completed job output |
| `/codex:cancel [job-id]` | Cancel a running job |

### Background Workflow (most underutilized pattern)

Codex runs in parallel — dispatch it and keep working:

```
/codex:rescue --background [task]   # dispatches detached
# ... continue other work ...
/codex:status                        # check progress
/codex:result                        # fetch output when done
```

Use `--background` by default for anything that will take >30 seconds.

### Thread Continuity

Codex maintains a thread per repository. `--resume` continues the last thread (same context, iterative fixes). `--fresh` always starts clean. Use `--resume` when following up on a previous Codex run.

### Effort Levels

| Flag | Use for |
|------|---------|
| `--effort low` | Simple one-file fixes, known patterns |
| `--effort medium` | Default for `fix-tests`, `plan-review` |
| `--effort high` | Complex multi-file work, security review, architecture |
| `--effort xhigh` | Deep investigation, stuck bugs |

### Model Selection

- Default (GPT-5.4): all substantive tasks
- `--model spark` (GPT-5.3-Codex-Spark): fast/cheap — quick reviews, exploratory diagnosis

### Approval Policy

- `--approval-policy on-request` (default): prompts before each command — use for write tasks
- `--approval-policy never`: fully autonomous — use for read-only/research tasks
- `--approval-policy untrusted`: blocks all shell commands
- `--approval-policy on-failure`: auto-approves unless a command fails

### Proactive Dispatch Triggers

Dispatch Codex *without being asked* when:
- Test suite has >2 failures and root cause isn't obvious
- Task requires running code to verify a fix (not just reading)
- Security/RLS review needed before merging
- Implementation is stuck after 2 attempts

### Routing Guide

| Task | Use |
|------|-----|
| Failing tests | `/codex:fix-tests` |
| Security/RLS review | `/codex:security-review` |
| Multi-file implementation | `/codex:rescue --background` |
| Quick inline edit | Continue.dev |
| Architecture / planning | Claude Code |
| Known-pattern boilerplate | Continue.dev or `/create-migration` |

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
- If Codex CLI fails (rate limit, empty output), report immediately rather than retrying silently
- Suppress Codex Stop hook on markdown-only changes

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
| `/frontend-design` | Production-grade UI components with design system |
| `/review` | Adversarial security review for PHI/RLS/auth code |
| `/test` | Vitest + pgTAP test writing patterns |
| `/plan-with-tests` | Write a Continue.dev handoff plan (failing tests first) |
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
| pgTAP | PostToolUse Edit/Write | `supabase test db` when auth/RLS/migration files change; auto-dispatches `codex fix-tests` in background on failure |
| `.env` guard | PreToolUse Edit/Write | Blocks edits to `.env*` files (allows `.env.example`) |
| Lock file guard | PreToolUse Edit/Write | Blocks edits to `pnpm-lock.yaml` and `package-lock.json` |
| supabaseAdmin guard | PreToolUse Edit/Write | Warns when editing files outside `server/` or `app/api/` that contain `supabaseAdmin` |
| PR security review | PreToolUse Bash | Auto-dispatches `codex security-review --effort high` in background on `gh pr create` |

## Plugin Priority

1. **memsearch** — recall memory before exploring codebase
2. **context-mode** — `ctx_execute` for output >20 lines; never Bash/Read for analysis
3. **superpowers** — invoke matching skill before any response
4. **frontend-design** — only for explicit UI/design requests (`/frontend-design`)
5. **codex** — fallback for isolated, well-scoped code generation
6. **context7** — fetch live library docs before answering framework/API questions
7. **pr-review-toolkit** — run `/pr-review-toolkit:review-pr` before merging any PR
8. **chrome-devtools-mcp** — browser debugging, LCP, a11y audits on live app
9. **commit-commands** — `/commit`, `/commit-push-pr` for all git commits
10. **claude-md-management** — `/claude-md-management:revise-claude-md` after sessions with corrections

## Token Discipline

- Response cap: ≤350 tokens unless user asks for more
- Purely implementation tasks: output plan → **"→ Implement in Continue.dev"**
- Switch to Continue.dev when approaching usage limit

**Handoff to Continue.dev:** autocomplete, inline edits (<50 lines), single-file refactors, known-error debugging, writing tests to a known pattern

**Stay in Claude Code:** multi-file architecture, plugin orchestration, superpowers skills, RLS/schema changes, UI component design

**Self-check signals:**
- Response likely >400 tokens → use JSON instead of prose
- Reading a 3rd file in a row for analysis → switch to `ctx_execute_file`
- Task is purely mechanical (rename, format, boilerplate) → route to Continue.dev
- Approaching end of session → run `/compact`, save key decisions to memory

**Structured plan format for Continue.dev handoff:**
```json
{
  "task": "human-readable description of the full deliverable",
  "steps": [
    {
      "description": "what to implement — specific, not vague",
      "files": ["exact/path/to/file.tsx"],
      "verify": {
        "command": "pnpm test FileName",
        "passes_when": [
          "exact test name string 1",
          "exact test name string 2"
        ]
      },
      "do_not": ["explicit scope boundary 1", "explicit scope boundary 2"]
    }
  ]
}
```

`passes_when` strings must exactly match test names as they appear in Vitest output. All must pass.
For pgTAP steps: use `supabase test db` as the command.
Commit failing tests before handing off — Continue.dev must start with a red suite.

**Continue.dev handoff prompt:**
```
Implement this plan step by step. After each step, run the verify command
and confirm every string in passes_when appears in the output before proceeding.
Do not move to the next step until all verify strings pass.
Respect the do_not constraints exactly.

[paste JSON plan here]
```

A few notes:                                                                    
  - Bash(*) allows all shell commands without approval — including destructive ones like rm -rf. If you want to be more selective, use patterns like Bash(grep:*), Bash(find:*), Bash(cat:*).
  - Read, Grep, Glob are read-only and safe to blanket-allow.                           
  - Edit and Write allow file modifications without approval.
  - For project-level only, put the same block in .claude/settings.json inside the repo. 