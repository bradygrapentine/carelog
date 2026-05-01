# Carelog

Family caregiving coordination platform. $14/mo family plan. Bootstrapped.
Monorepo: `apps/`, `packages/`, `supabase/`.

## Design context

- `PRODUCT.md` (repo root) — register, users, brand personality, anti-references, design principles. Read before any UI/UX work.
- `DESIGN.md` (repo root, when present) — visual system: colors, typography, components, motion. Pairs with `PRODUCT.md`.
- `.claude/rules/ui-standards.md` — hard UI rules (tokens, WCAG AA, panel/form patterns). Load before touching `apps/web/app/` or `apps/web/components/`.

The `/impeccable` command suite reads these. Run `/impeccable teach` to refresh, `/impeccable document` to regenerate `DESIGN.md` from current code.

## READ FIRST — the backlog is the single source of truth

**Before any task**, read `BACKLOG.md` at the repo root. Every planned feature, bug fix, tech-debt item, a11y task, and polish story lives there with a lifecycle status (`Ready` / `In progress` / `In review` / `Blocked` / `Shipped`).

Rules — non-negotiable:

1. **Start every session / resumed task by reading `BACKLOG.md` §0 (status board) and the relevant §1–§5 row.** Do not explore code to figure out what's "next" — the backlog answers that.
2. **Feature/fix PRs DO NOT touch `BACKLOG.md` at all.** No row updates, no status flips, no new follow-up TD rows in feature commits. Story status is derivative — `/backlog-sync` reconstructs it from git log + PR list. Two PRs touching adjacent rows in the same markdown table create guaranteed conflicts on rebase; today's 2026-04-25 session was 90% rebase pain because 5 of 7 PRs touched BACKLOG.md for legitimate-seeming reasons. A conventional-commit subject (`feat(td-24): …`) is enough for `/backlog-sync` to find the story.
3. **Add new TD/ON rows in dedicated `chore(backlog): …` PRs** — never bundle them into a feature PR. If you discover follow-up work mid-feature, capture it as a TODO in the PR description; open a fresh BACKLOG-only PR after the feature merges (or let `/backlog-sync` pick it up).
4. **Never track planned work anywhere else.** Not in PR descriptions long-term, not in memory, not in ad-hoc markdown. New work = new row in a backlog PR with `Status: 🟢 Ready` and the right prefix (`TD-*`, `A11Y-*`, `ON-*`, `PP-*`, `UX-*`).
5. **Run `/backlog-sync`** at session start, at session end (via `/session-end`), and on a daily cron (`/schedule`). It rewrites everything (rows + §0 counts) on its own branch — that's where ALL backlog edits happen.
6. BACKLOG.md §7 is the **shipped log**. There is no separate BUILD_STATUS or TECH_DEBT — everything lives in BACKLOG.md.

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
pnpm test               # Vitest unit tests (monorepo root — 173 tests)
cd apps/web && npx vitest run  # full web test suite (961 tests, used by pre-commit hook)
cd apps/web && npx tsc --noEmit  # web typecheck (no pnpm script; pnpm --filter web typecheck does not exist)
supabase test db        # RLS pgTAP tests — see supabase/CLAUDE.md
pnpm exec playwright test  # E2E — see e2e/CLAUDE.md
```

## Known Gotchas

- **Supabase type gen**: Always `npx supabase gen types typescript --local 2>/dev/null > apps/web/lib/database.types.ts` — omitting `2>/dev/null` prepends Docker startup logs to the file, producing invalid TypeScript.
- **ShiftForm / ShiftList** live in `apps/web/app/(app)/journal/[recipientId]/`, not a standalone `/shifts/` route.
- **Bash paths with `(app)` or `[recipientId]`** need quoting in zsh: `"apps/web/app/(app)/..."` — unquoted triggers glob expansion failures.
- **Pre-commit hook** runs `cd apps/web && npx vitest run --reporter=dot 2>&1 | tail -5` — only the last 5 lines of test output are visible; run the command manually to see the full error if it fails.
- **Main-commit hook timing**: The PreToolUse hook checks `git branch --show-current` *before* the Bash command runs. Never chain `git checkout -b <branch> && git commit` in one Bash call — the hook sees `main` and blocks. Always split into two separate Bash calls.
- **Parallel subagent BACKLOG.md conflicts**: When rebasing branches from parallel subagents, BACKLOG.md always conflicts. Resolution: `git checkout --theirs BACKLOG.md && git add BACKLOG.md && GIT_EDITOR=true git rebase --continue`. Main's BACKLOG.md is always more current than the branch's status-flip.
- **Story ID collisions**: Before assigning a new A11Y/TD/UX ID, grep §7 shipped log — IDs may already be taken there. Use `grep "A11Y-0[0-9][0-9]\|TD-[0-9]" BACKLOG.md` to find the highest used ID.
- **Worktree commits + main-branch guard hook (2026-04-25)**: The `git commit` PreToolUse guard checks `git branch --show-current` from the **harness root cwd**, not the worktree where the commit is actually running. If the harness root is on `main`, the hook hard-blocks every worktree commit even when the worktree itself is on a feature branch. Workaround: switch the harness root off main first (`cd /Users/bradygrapentine/projects/carelog && git checkout -B chore/<scratch>`) before committing in any worktree.
- **Pre-commit vitest flake on YAML/markdown-only diffs (2026-04-25)**: The pre-commit `vitest run` hook flakes non-deterministically on PRs whose diff touches only `*.yml` / `*.md` (no JS/TS source change can affect the test outcome). Hit twice in a single session on TD-32. If you see `1 failed` and the diff is config/docs only, run `cd apps/web && npx vitest run` manually to verify. If manual run is green, retry the commit — don't reach for `--no-verify`.
- **React 19 react-hooks/purity rule (2026-05-01)**: `Date.now()`, `Math.random()`, and similar impure calls inside `useMemo` / `useCallback` / a render body throw a hard lint error. The pre-commit hook only runs vitest, so the failure surfaces in CI Lint, not locally. Fix patterns: (1) for component-internal "now" anchors, use `const [now] = useState(() => Date.now())` — lazy init runs once at mount and the value stays stable; (2) for pure helpers, accept `now: Date` as a parameter so the call site is responsible. Run `cd apps/web && npx eslint --quiet '<path>'` locally before push when touching hook bodies. Hit on PR #364.
- **Subagent context exhaustion mid-commit (2026-05-01)**: When a dispatched subagent has 4+ files to write before the final commit, the pre-commit vitest hook (~30–60s) inside the commit can exhaust the agent's remaining context. The agent reports "completed" while the worktree still has files staged-but-uncommitted. **Mitigation:** brief 4+-file dispatches to push the branch EARLY (after red-phase test commit) so subsequent green-phase commits land on the open PR. **Recovery:** when an agent reports "completed" but `gh pr list` shows no new PR, `cd .worktrees/<name> && git status` — finish the commit + push + PR yourself.

## Code Style

- `type` over `interface`; no `enum` — use string literal unions
- Web-specific rules: see `apps/web/CLAUDE.md`
- Supabase/RLS rules: see `supabase/CLAUDE.md`

## Plan Mode

- Start every complex task (3+ files) in plan mode
- Pour energy into the plan → 1-shot implementation
- When something goes sideways, re-plan — don't keep pushing

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

## Reference Docs (load on demand)

- `docs/project-info/technology/ARCHITECTURE.md` — data model, system design, design rationale
- `docs/project-info/technology/CODE_STANDARDS.md` — hard-won coding rules, conventions, testing patterns, git format
- `docs/project-info/product/UX_DECISIONS.md` — language and tone rules
- `.claude/rules/ui-standards.md` — hard UI rules (tokens, WCAG AA, responsive, panel/form patterns). Load before any work under `apps/web/app/` or `apps/web/components/`.
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

## Token Discipline

- Response cap: ≤350 tokens unless the task demands more
- Mechanical work (boilerplate, single-file refactor, known-pattern tests, bulk exploration) → dispatch to `/ollama`
- 3+ independent subtasks → parallel fan-out via `/ollama` rather than serial Claude work
- Full routing, self-check signals, and handoff plan format: `docs/project-info/runbooks/TOKEN_DISCIPLINE.md`
