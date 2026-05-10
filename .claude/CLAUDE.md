# Carelog

Family caregiving coordination platform. $14/mo family plan. Bootstrapped.
Monorepo: `apps/`, `packages/`, `supabase/`.

## Load-bearing constants

Pin canonical values here so they don't drift across files:

- **Pricing:** $14/month family plan. Bootstrapped, single price point.
- **Web test suite:** ~1980 vitest tests across 245+ files in `apps/web` (pre-commit hook runs scoped to changed files).
- **Pre-commit gate:** related-files vitest only; full suite via `cd apps/web && npx vitest run`.
- **Branch protection:** GitHub native auto-merge; merge with `gh pr merge <num> --auto --squash`. No Mergify.
- **Codex:** disabled until **2026-05-16** (quota exhausted). Adversarial gates route to Sonnet subagent or `/grill` slash command.
- **PHI rule:** `posthog.identify()` and `posthog.capture()` use anonymous UUID only — never email, name, phone. See `docs/adr/0001-phi-anonymous-uuid-only.md`.
- **BACKLOG-as-SoT:** `BACKLOG.md` is single source of truth. Feature/fix PRs do NOT touch it. New TD/ON rows go in dedicated `chore(backlog):` PRs. See `docs/adr/0002-backlog-as-single-source-of-truth.md`.

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
5. **Run `/backlog-sync`** at session start and at session end (via `/session-end`). It rewrites everything (rows + §0 counts) on its own branch — that's where ALL backlog edits happen. Do **not** schedule it on a cron — see global "No Overnight Plans" rule.
6. BACKLOG.md §7 is the **shipped log**. There is no separate BUILD_STATUS or TECH_DEBT — everything lives in BACKLOG.md.

If you catch yourself about to start work without a backlog row, stop and create the row first.

## Development Workflow

1. Make changes
2. `pnpm typecheck`
3. `pnpm test`
4. Before PR: `pnpm lint` + full test suite + `supabase test db`

### Pre-flight audit (before multi-task sessions)

Before any planned or multi-task work: `git log --oneline -20`, grep target files/symbols, check backlog rows for shipped status. Produce a done/partial/todo table before touching code. **Before writing any new file**, run Glob/Grep to verify it doesn't already exist — components, migrations, utilities, anything.

### Testing first

When asked to fix failing tests, run the test command first and read the actual failure output. Do not explore the codebase before seeing the real errors — the failure message usually points at the exact file and line.

### Interactive Commands

These block on stdin — Claude **cannot** run them. Ask the user to run manually and paste output. Do not pipe input or use `expect`.

- `eas login`, `eas build --auto-submit`, `eas submit`
- `supabase login`
- Any OAuth / browser-redirect authentication flow
- `npx create-*` interactive prompts

## Commands

```sh
supabase start          # Must run first
pnpm web                # localhost:3000
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
pnpm test               # Vitest unit tests (monorepo root — 173 tests)
cd apps/web && npx vitest run  # full web test suite (~1900 tests across 240+ files, used by pre-commit hook)
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
- **Parallel-dispatch BACKLOG.md conflicts**: Per the BACKLOG-as-SoT rule, feature/fix PRs should not touch `BACKLOG.md` — but if a stray status-flip slips into a parallel branch, the rebase will conflict. Resolution: `git checkout --theirs BACKLOG.md && git add BACKLOG.md && GIT_EDITOR=true git rebase --continue`. Main's BACKLOG.md is always more current than any branch's status-flip; let `/backlog-sync` rewrite it on its own branch.
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

Start every complex task (3+ files) in plan mode. Pour energy into the plan → 1-shot implementation. When something goes sideways, re-plan — don't keep pushing.

## Merge Policy

> **The behavioral rule**: merge a PR with `gh pr merge <num> --auto --squash` after `gh pr create`. The repo uses GitHub native auto-merge; an external browser-extension auto-rebaser keeps the head branch current as siblings land. Do NOT use a `queue` label — Mergify is not in use here. Schedule a 10–15 min wakeup after arming auto-merge to verify the PR landed (silent stalls are the worst failure mode). Per the global rule: attempt `--auto --squash` exactly once; if it's rejected (failing checks, conflicts, branch protection), print the PR URL + `gh pr checks` status + what's blocking and hand off — do not retry.

## Branch Hygiene

- Always verify with `git branch --show-current` before every commit (not just at session start — concurrent Claude instances can switch branches under you).
- When dispatching subagents, pass the target branch and require them to verify before committing.
- Never commit to main/master without confirmation. If the wrong branch was committed to, `git cherry-pick` onto the correct branch rather than reset.

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
- **Automated enforcement (TD-117):** the project-local ESLint rule `carelog/no-phi-in-analytics` (in `apps/web/eslint-rules/`) fails the lint gate if any forbidden property key (`email`, `name`, `phone`, `dob`, `ssn`, `firstname`, `lastname`, `fullname`, `address`, `zip`, `street`, `city`) appears in an object literal passed to `posthog.identify` / `posthog.capture` / `Sentry.setUser` / `Sentry.setContext`. Codifies ADR-0001. Limitation: doesn't catch spread elements or variable references — those still need code review.

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

1. **Model selection.** Sonnet (`Task` tool) for multi-file or judgment-heavy work (2–6 files). `/ollama` for single-file stubs, boilerplate, exploration. Haiku only as fallback when local Ollama is unavailable. Never use Haiku for code touching multiple files.
2. **Pre-flight checklist.** See [HARNESS_USAGE.md §"Subagent Dispatch — pre-flight checklist"](../docs/project-info/runbooks/HARNESS_USAGE.md#subagent-dispatch--pre-flight-checklist) for the full pre-flight (worktree node_modules symlinks, Docker, branch checks, DB-table injection).
3. **Review before merge.** Read the subagent diff for: invented DB tables, out-of-scope features, PHI in analytics calls. Require each subagent to include a diff summary in their response.

## Project slash commands

- `/grill` — adversarial review of current branch diff vs `origin/main` via a Sonnet subagent (Codex replacement until 2026-05-16).
- `/techdebt` — read-only TODO/FIXME/HACK + dead-export scan; emits a punch-list, no edits.

**ADRs:** `docs/adr/` — load-bearing decision records (PHI UUID-only, BACKLOG-as-SoT). Run the global `write-adr` skill to add new ones.

## Reference Docs (load on demand)

- `docs/project-info/technology/ARCHITECTURE.md` — data model, system design, design rationale
- `docs/project-info/technology/CODE_STANDARDS.md` — hard-won coding rules, conventions, testing patterns, git format
- `docs/project-info/product/UX_DECISIONS.md` — language and tone rules
- `.claude/rules/ui-standards.md` — hard UI rules (tokens, WCAG AA, responsive, panel/form patterns). Load before any work under `apps/web/app/` or `apps/web/components/`.
- `docs/project-info/technology/TROUBLESHOOTING.md` — local dev fixes (Supabase, auth, Turbopack)
- `docs/project-info/runbooks/HARNESS_USAGE.md` — **harness reference**: hooks, skills, agents, MCP, plugin priority, model routing, Ollama dispatch, merge policy
- `docs/project-info/runbooks/TOKEN_DISCIPLINE.md` — Ollama dispatch patterns, handoff plan format

## Things Claude Should NOT Do

- Don't use `any` without explicit approval; don't auto-import large reference docs; don't claim done without running verification first; don't edit files during code review.

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

## General Rules

- When the user confirms 'Yes' or similar: treat it as confirmation of the previously proposed action — not as answering a question.
- When instructed to read docs or follow a specific document: read those files FIRST before exploring the codebase.
- Do not present option menus or ask clarifying questions when the user has given a clear, specific request. Execute directly — including for named deliverables like "create these 3 runbooks".

## Self-Improvement

After every correction, update this file immediately. End corrections with: "Now update CLAUDE.md so you don't make that mistake again."

## Token Discipline

Response cap ≤350 tokens unless task demands more. Dispatch mechanical work (boilerplate, single-file refactor, bulk exploration) to `/ollama`; 3+ independent subtasks → parallel fan-out. Full routing + handoff format: `docs/project-info/runbooks/TOKEN_DISCIPLINE.md`.
