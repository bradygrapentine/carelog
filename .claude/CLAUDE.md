# Carelog

Family caregiving coordination platform. $14/mo family plan. Bootstrapped.
Monorepo: `apps/`, `packages/`, `supabase/`.

## READ FIRST — the backlog is the single source of truth

**Before any task**, read `BACKLOG.md` at the repo root. Every planned feature, bug fix, tech-debt item, a11y task, and polish story lives there with a lifecycle status (`Ready` / `In progress` / `In review` / `Blocked` / `Shipped`).

Rules — non-negotiable:

1. **Start every session / resumed task by reading `BACKLOG.md` §0 (status board) and the relevant §1–§5 row.** Do not explore code to figure out what's "next" — the backlog answers that.
2. **Update `BACKLOG.md` in the same commit as the work.** Status transitions (pick up → in review → shipped → blocked) are part of the change, not a follow-up. See `BACKLOG.md` §10 for the transition table.
3. **Never track planned work anywhere else.** Not in PR descriptions, not in memory, not in ad-hoc markdown. New work = new row with `Status: 🟢 Ready` and the right prefix (`TD-*`, `A11Y-*`, `ON-*`, `PP-*`, `UX-*`).
4. **Run `/backlog-sync`** at session start, at session end (via `/session-end`), and on a daily cron (`/schedule`). It reconciles BACKLOG.md against git/PRs and rewrites the §0 counts. Never hand-edit §0.
5. `BUILD_STATUS.md` and `TECH_DEBT.md` are **historical logs**. Do not add new items there — open a `TD-*` row in BACKLOG.md instead.

If you catch yourself about to start work without a backlog row, stop and create the row first.

## Development Workflow

1. Make changes
2. `pnpm typecheck`
3. `pnpm test`
4. Before PR: `pnpm lint` + full test suite + `supabase test db`

### Pre-flight audit (before multi-task sessions)

Before starting any planned or multi-task work, verify what is already done. Run `git log --oneline -20`, grep the codebase for the target files/symbols, and check the relevant backlog doc for `✅ DONE`/strike-through markers. Produce a status table (done/partial/todo) before touching code. Skipping this step has repeatedly led to re-implementing completed work.

**Before writing any new file**, run Glob/Grep to verify it doesn't already exist. This applies to components, migrations, utilities — anything. Discovering a file already exists mid-implementation wastes context and produces duplicates.

### Testing first

When asked to fix failing tests, run the test command first and read the actual failure output. Do not explore the codebase before seeing the real errors — the failure message usually points at the exact file and line.

### Interactive Commands

These CLIs block on stdin — Claude **cannot** run them from Bash. Recognize them immediately and ask the user to run manually, then paste the output. Do not attempt to pipe input or use `expect`.

- `eas login`, `eas build --auto-submit`, `eas submit`
- `supabase login`
- Any OAuth / browser-redirect authentication flow
- `npx create-*` prompts that ask questions interactively

Pattern: if a command requires typing into a prompt, it belongs to the user, not Claude.

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
- A concurrent Claude instance may switch branches under you. Re-run `git branch --show-current` immediately before every commit, not just at the start of a session. If the wrong branch was committed to, `git cherry-pick` onto the correct branch rather than reset.

### Rebase before pushing to a PR

- Before opening a PR or pushing a new commit to an existing PR branch, rebase against the latest `origin/main`:
  ```sh
  git fetch origin main && git rebase origin/main
  ```
- If the rebase produces conflicts, resolve them (do not `git rebase --skip`) and re-run the test suite before continuing.
- Never force-push to `main` or to a PR branch owned by someone else. Force-push on your own PR branch is allowed after rebase (`git push --force-with-lease`, never `--force`).
- If the PR is merged and new work should continue, branch fresh off updated `origin/main` rather than reusing a merged branch.

## PHI & Privacy Rules

Hard invariant — applies to every agent, subagent, and Claude instance (including the main orchestrator) working in this repo:

- `posthog.identify()` and `posthog.capture()` must use **anonymous UUID only** — never email, name, phone number, or any PII/PHI.
- This applies to all analytics platforms (PostHog, Segment, Amplitude, or any future service) across web, mobile, and any future surface.
- Any subagent touching analytics files (any file importing `posthog` or a similar analytics SDK, or containing `identify`/`capture` calls) must have its diff reviewed by Opus before merge.
- When writing the subagent scope contract, always include: `PHI RULE: posthog.identify() and posthog.capture() must use UUID only — never email, name, or any PII`

## Parallel Work

- Subagents only for genuinely independent tasks (different files, no shared state)
- Max 2 background agents per session
- Worktrees: `git worktree add .worktrees/<name> origin/main`

### Subagent Scope Contract (required for every dispatch)

Every subagent dispatch MUST include an explicit scope contract. Never dispatch without it:

```
FILES ALLOWED: [exact list of files the subagent may create or modify]
BRANCH: [exact branch name — subagent must verify with `git branch --show-current` before committing]
DO NOT: add features outside the ticket, touch files not listed above, pass email/PHI to analytics
PHI RULE: posthog.identify() and posthog.capture() must use UUID only — never email, name, or any PII
VERIFY: run tests before committing; summarize what changed and what was intentionally NOT changed
```

Subagents that go out of scope (add unrelated features, leak PHI, commit to wrong branch) require reverts and cherry-picks. The scope contract prevents this.

### Subagent Dispatch Rules

1. **Model selection for subagents:**
   - Sonnet (`Task` tool) for multi-file or judgment-heavy work (2–6 files, moderate refactors)
   - Local Ollama (`/ollama`) for lower-level tasks: single-file stubs, boilerplate, exploration, known-pattern work
   - Haiku only as fallback when local Ollama is unavailable
   - Never use Haiku for code changes touching multiple files

2. **Pre-flight before every dispatch** (inline checklist in each dispatch skill):
   - Each worktree has `node_modules` installed — run `pnpm install` if missing
   - Each subagent's target branch ≠ `main` (verify with `git branch --show-current`)
   - Docker running if Supabase/migration work is involved
   - No interactive-login CLIs in scope (eas login, supabase login, etc.)
   - Pass relevant DB table names in the prompt to prevent schema invention

3. **Review before merge:**
   - Read the subagent diff for: invented DB tables, out-of-scope features, PHI in analytics calls
   - Require each subagent to include a diff summary in their response

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
- `.claude/rules/ui-standards.md` — hard UI rules (tokens, WCAG AA, responsive, panel/form patterns). Load before any work under `apps/web/app/` or `apps/web/components/`.
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

## Deliver Artifacts — Don't Explore

When asked to produce a specific artifact (review report, test file, runbook, coverage analysis), **produce the artifact immediately**:

1. Create the output file with section headers as the very first action
2. Fill each section with findings — reading only what each section needs
3. Return the completed artifact

Do NOT read 10 files "to understand the codebase" before producing output. Reading files for exploration instead of writing the artifact is the most common failure mode in review/test/runbook sessions. If you find yourself opening a 4th file before writing a single line of output, stop and start the output file first.

## Status Reporting Honesty

When verifying "is X working?", always check an **authoritative source** — never declare success based on a UI state that could be echoing the user's own input.

| What to verify | Authoritative source |
|---|---|
| Server running | `ps aux`, health endpoint, server logs |
| Tests passing | Test runner exit code (`echo $?`) |
| DB migration applied | `supabase db diff` or direct query |
| Build deployed | Deployment platform logs / status API |
| Message received | Read from inbox, not sent-messages list |
| Feature flag active | SDK `isEnabled()` call, not UI assumption |

Classic failure: reporting iMessage "working" because sent messages appeared in Messages.app — the channel server was down; those were the user's own outbound texts reflected back.

## Review Mode (READ-ONLY)

Any request containing "review", "audit", "adversarial", "security check", or "coverage gap analysis" is a READ-ONLY task. Rules:

- Do NOT use Edit, Write, or any mutation tool until the review report is delivered AND the user explicitly authorizes fixes.
- Output a single report: severity-ranked findings (Critical / Medium / Low / None), each with `file:line`, the issue, and a suggested fix.
- Do NOT explore files looking for "things to fix along the way" — stay scoped to the requested surface.
- If you catch yourself about to open an Edit tool during a review, stop and emit the report instead.
- Prefer the `/review` skill (parallel subagents) over a single-agent review path.
- If a dispatched review agent stalls or returns empty, report immediately rather than retrying silently.

## Code Reviews (general)

- When the user confirms 'Yes' or similar affirmation: treat it as confirmation of the previously proposed action — not as answering a question.

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
| `/mobile-ui` | Drive iOS Simulator: boot, launch Expo, deep-link routes, screenshot (visual UI investigation) |
| `/worktree-subagents` | Dispatch parallel subagents with isolated file state |
| `/ollama` | Dispatch parallel tasks to local Ollama models (Opus/Sonnet stays as orchestrator) |
| `/session-end` | End-of-session cleanup: revise CLAUDE.md, save memory, check git status |
| `/supabase-types` | Regenerate TypeScript types from local Supabase after migrations |
| `/backlog-sync` | Reconcile BACKLOG.md against git log + open PRs; rewrite §0 status board; flag stale/unblocked rows. Run at session start, end, and daily. |
| `/backlog-dispatch` | Dispatch parallel subagents against all `🟢 Ready` BACKLOG.md items — each gets a worktree, feature branch, tests-first implementation, and PR. For overnight batch execution. |

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
