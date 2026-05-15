# Carelog
Family caregiving coordination platform. $14/mo family plan. Bootstrapped. Monorepo: `apps/`, `packages/`, `supabase/`.

## Load-bearing constants
- **Pricing:** $14/month family plan, single price point.
- **Web test suite:** ~1980 vitest tests across 245+ files in `apps/web` (pre-commit hook scoped to changed files).
- **Pre-commit gate:** related-files vitest only; full via `cd apps/web && npx vitest run`.
- **Branch protection:** GitHub native auto-merge; merge with `gh pr merge <num> --auto --squash`. No Mergify.
- **Codex:** disabled until **2026-05-16** (quota exhausted). Adversarial gates route to Sonnet subagent or `/grill`.
- **PHI rule:** `posthog.identify()` and `posthog.capture()` use anonymous UUID only — never email, name, phone. See `docs/adr/0001-phi-anonymous-uuid-only.md`.
- **BACKLOG-as-SoT:** `BACKLOG.md` is single source of truth. Feature/fix PRs do NOT touch it. New TD/ON rows go in dedicated `chore(backlog):` PRs. See `docs/adr/0002-backlog-as-single-source-of-truth.md`.

## Design context
- `PRODUCT.md` (root) — register, users, brand personality, anti-references, design principles.
- `DESIGN.md` (root, when present) — visual system.
- `.claude/rules/ui-standards.md` — hard UI rules (tokens, WCAG AA, panel/form patterns). Load before any work under `apps/web/app/` or `apps/web/components/`.

`/impeccable teach` to refresh; `/impeccable document` regenerates `DESIGN.md` from code.

## READ FIRST — backlog is single source of truth
Before any task: read `BACKLOG.md` §0 (status board) and the relevant §1–§5 row. Don't explore code to find what's "next" — the backlog answers.

Non-negotiable:

1. Start every session by reading §0 + the target row.
2. **Feature/fix PRs DO NOT touch BACKLOG.md** — no row updates, status flips, or follow-up rows in feature commits. Story status is derivative; `/backlog-sync` rebuilds it from git log + PR list. Adjacent-row edits in parallel PRs guarantee rebase conflicts (2026-04-25 session was 90% rebase pain for this reason). Conventional-commit subject (`feat(td-24): …`) is enough for `/backlog-sync` to track.
3. New TD/ON rows go in dedicated `chore(backlog): …` PRs — never bundled. Mid-feature discoveries → TODO in PR description → fresh BACKLOG-only PR after merge (or let `/backlog-sync` pick up).
4. Never track planned work elsewhere (PR descriptions long-term, memory, ad-hoc markdown). New work = new row, `Status: 🟢 Ready`, right prefix (`TD-*`, `A11Y-*`, `ON-*`, `PP-*`, `UX-*`).
5. Run `/backlog-sync` at session start AND end (via `/session-end`). Rewrites on its own branch — ALL backlog edits happen there. Do not cron it (global "No Overnight Plans").
6. §7 is the shipped log. No separate BUILD_STATUS or TECH_DEBT.

## Development Workflow
1. Make changes → `pnpm typecheck` → `pnpm test` → before PR: `pnpm lint` + full test suite + `supabase test db`.
2. **Pre-flight audit (multi-task sessions):** `git log --oneline -20`, grep target files/symbols, check backlog rows. Produce done/partial/todo table before code. Before writing ANY new file, Glob/Grep to verify it doesn't already exist.
3. **Testing first:** when fixing failing tests, run the test command FIRST and read the actual failure — the message usually points at the file:line.
4. **Interactive commands** Claude cannot run (blocks on stdin): `eas login`, `eas build --auto-submit`, `eas submit`, `supabase login`, any OAuth, `npx create-*` prompts. Ask user to run, paste output.
5. Before opening a migration PR: `pnpm migration-check` to surface any drift between local and linked-prod schema. Operator discipline — not CI-enforced today (see TD-136 for the CI variant).

## Commands
```sh
supabase start
pnpm web                         # :3000
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
pnpm test                        # monorepo root (173 tests)
cd apps/web && npx vitest run    # full web suite (~1900 tests)
cd apps/web && npx tsc --noEmit  # web typecheck (no pnpm script)
supabase test db                 # RLS pgTAP — supabase/CLAUDE.md
pnpm exec playwright test        # E2E — e2e/CLAUDE.md
```

## Known Gotchas
- **Supabase type gen:** `npx supabase gen types typescript --local 2>/dev/null > apps/web/lib/database.types.ts` — omitting `2>/dev/null` prepends Docker logs and breaks TS.
- **ShiftForm/ShiftList** live in `apps/web/app/(app)/journal/[recipientId]/`, not `/shifts/`.
- **Zsh path quoting:** paths with `(app)` or `[recipientId]` need quotes.
- **Pre-commit hook** shows only last 5 lines of vitest output; run manually for full error.
- **Main-commit hook timing:** PreToolUse checks `git branch --show-current` *before* the Bash runs. Never chain `git checkout -b <branch> && git commit` — hook sees `main` and blocks. Two separate Bash calls.
- **Parallel-dispatch BACKLOG.md conflicts:** per BACKLOG-as-SoT, feature/fix PRs shouldn't touch it — but if a status-flip slips in, rebase: `git checkout --theirs BACKLOG.md && git add BACKLOG.md && GIT_EDITOR=true git rebase --continue`. Main's BACKLOG.md is always more current; let `/backlog-sync` rewrite.
- **Story ID collisions:** grep §7 shipped log before assigning new IDs: `grep "A11Y-0[0-9][0-9]\|TD-[0-9]" BACKLOG.md`.
- **Worktree commits + main-guard hook:** the guard checks branch from harness root cwd, not worktree. If root is on `main`, every worktree commit is blocked. Workaround: `cd <project-root> && git checkout -B chore/<scratch>` before committing in any worktree.
- **Pre-commit vitest flake on YAML/markdown-only diffs:** non-deterministic on diffs touching only `*.yml`/`*.md`. If you see `1 failed` and the diff is config/docs only, run vitest manually to verify before retrying. Don't reach for `--no-verify`.
- **React 19 react-hooks/purity:** `Date.now()`, `Math.random()`, similar impure calls inside `useMemo`/`useCallback`/render body throw a hard lint error. Pre-commit runs only vitest so it surfaces in CI Lint, not locally. Fix: (1) component-internal "now" anchors → `const [now] = useState(() => Date.now())`; (2) pure helpers → accept `now: Date` parameter. Run `cd apps/web && npx eslint --quiet '<path>'` before push when touching hooks.
- **Subagent context exhaustion mid-commit:** when an agent has 4+ files to write before final commit, the pre-commit vitest hook (~30–60s) can exhaust remaining context. Agent reports "completed" while worktree has staged-but-uncommitted files. Mitigation: brief 4+-file dispatches to push EARLY (after red-phase test commit). Recovery: when agent reports "completed" but no PR exists, `cd .worktrees/<name> && git status` — finish commit+push+PR yourself.

## Code Style
- `type` over `interface`; no `enum` — string literal unions only.
- Web-specific: `apps/web/CLAUDE.md`. Supabase/RLS: `supabase/CLAUDE.md`.

## Plan Mode
Start complex tasks (3+ files) in plan mode. Pour energy into the plan → 1-shot implementation. When something goes sideways, re-plan — don't keep pushing.

## Merge Policy
Merge with `gh pr merge <num> --auto --squash` after `gh pr create`. GitHub native auto-merge; external browser-extension auto-rebaser keeps head current as siblings land. No `queue` label — Mergify is not in use. Schedule a 10–15 min wakeup after arming auto-merge to verify the PR landed. Attempt `--auto --squash` exactly once; if rejected, print PR URL + `gh pr checks` + blocker, hand off — don't retry.

## Branch Hygiene
- Verify `git branch --show-current` before every commit (concurrent Claude instances can switch branches under you).
- Subagent dispatches must include target branch name; subagent verifies before commit.
- Never commit to main/master without confirmation. If you committed to the wrong branch, cherry-pick — don't reset.
- **Rebase before pushing:** `git fetch origin main && git rebase origin/main`. Resolve conflicts (don't `--skip`) and re-run tests. Force-push only `--force-with-lease`, never `--force`, and only on your own PR branch.

## PHI & Privacy
Hard invariant across every agent + subagent:

- `posthog.identify()` and `posthog.capture()` use **anonymous UUID only** — no email, name, phone, or PII/PHI. Applies to all analytics platforms (PostHog, Segment, Amplitude, future).
- Any subagent touching analytics files (imports `posthog` or contains `identify`/`capture`) must have its diff reviewed by Opus before merge.
- Scope contracts MUST include: `PHI RULE: posthog.identify() and posthog.capture() must use UUID only — never email, name, or any PII`.
- **Automated enforcement (TD-117):** project-local ESLint rule `carelog/no-phi-in-analytics` fails lint if forbidden keys (`email`, `name`, `phone`, `dob`, `ssn`, `firstname`, `lastname`, `fullname`, `address`, `zip`, `street`, `city`) appear in object literals passed to `posthog.identify`/`capture`/`Sentry.setUser`/`Sentry.setContext`. Doesn't catch spreads/variable refs — those need review.

## Parallel Work
- Subagents only for genuinely independent tasks (different files, no shared state). Max 2 background agents per session.
- Worktrees: `git worktree add .worktrees/<name> origin/main`.

**Scope contract (required every dispatch):**

```
FILES ALLOWED: [exact list]
BRANCH: [exact name — subagent verifies with `git branch --show-current` before commit]
DO NOT: add out-of-ticket features, touch unlisted files, pass email/PHI to analytics
PHI RULE: posthog.identify()/capture() use UUID only — never email, name, or PII
VERIFY: run tests before commit; summarize changed + intentionally-NOT-changed
```

Out-of-scope subagents require reverts and cherry-picks. Contract prevents this.

**Dispatch routing:**
1. Sonnet (Task tool) for multi-file or judgment-heavy work (2–6 files). `/ollama` for single-file stubs, boilerplate, exploration. Haiku only when Ollama is unavailable; never for multi-file code.
2. Full pre-flight: [`HARNESS_USAGE.md §Subagent Dispatch`](../docs/project-info/runbooks/HARNESS_USAGE.md#subagent-dispatch--pre-flight-checklist).
3. Review subagent diff for invented DB tables, out-of-scope features, PHI in analytics. Each subagent includes a diff summary in their response.

## Project slash commands
- `/grill` — adversarial review of current branch diff vs `origin/main` via Sonnet (Codex replacement until 2026-05-16).
- `/techdebt` — read-only TODO/FIXME/HACK + dead-export scan; emits punch-list, no edits.

**ADRs:** `docs/adr/` — load-bearing decisions (PHI UUID-only, BACKLOG-as-SoT). Use global `write-adr` for new ones.

## Reference Docs (load on demand)
- `docs/project-info/technology/ARCHITECTURE.md` — data model, system design.
- `docs/project-info/technology/CODE_STANDARDS.md` — conventions, testing, git format.
- `docs/project-info/product/UX_DECISIONS.md` — language and tone.
- `.claude/rules/ui-standards.md` — UI tokens, WCAG AA, panel/form patterns.
- `docs/project-info/technology/TROUBLESHOOTING.md` — local dev fixes.
- `docs/project-info/runbooks/HARNESS_USAGE.md` — hooks, skills, agents, MCP, routing.
- `docs/project-info/runbooks/TOKEN_DISCIPLINE.md` — Ollama dispatch, handoff format.

## Things NOT to do
Don't use `any` without explicit approval. Don't auto-import large reference docs. Don't claim done without running verification. Don't edit files during code review.

## Deliver artifacts — don't explore
When asked for a specific artifact (review report, test file, runbook, coverage analysis): produce the artifact immediately. (1) Create the output file with section headers as the very first action. (2) Fill each section by reading only what that section needs. (3) Return the completed artifact. Reading 10 files "to understand the codebase" before producing output is the dominant failure mode in review/test/runbook sessions. If you've opened a 4th file before writing a line, stop and start the output.

## Status reporting honesty
Verify "is X working?" against an **authoritative source** — never declare success based on UI state that could echo user input.

| Verify | Authoritative source |
|---|---|
| Server running | `ps aux`, health endpoint, server logs |
| Tests passing | Exit code (`echo $?`) |
| DB migration | `supabase db diff` or direct query |
| Build deployed | Platform logs / status API |
| Message received | Read inbox, not sent-list |
| Feature flag active | SDK `isEnabled()`, not UI |

Classic failure: reporting iMessage "working" because sent messages appeared in Messages.app — channel server was down; those were the user's own outbound texts reflected back.

## Review Mode (READ-ONLY)
Any request with "review", "audit", "adversarial", "security check", or "coverage gap analysis" is READ-ONLY. No Edit/Write until the report is delivered AND fixes explicitly authorized. Output: single severity-ranked report (Critical / Medium / Low / None) with `file:line`, issue, suggested fix. Don't open files looking for "things to fix along the way" — stay scoped. Prefer `/review` (parallel subagents) over single-agent. If a review agent stalls or returns empty, report immediately — don't retry silently.

## General Rules
- User "Yes" confirms the previously proposed action — not an answer to a question.
- When instructed to read docs first, read FIRST before exploring code.
- Don't present menus or ask clarifying questions when the request is clear and specific. Execute directly — including named deliverables like "create these 3 runbooks".

## Self-Improvement
After every correction, update this file immediately. End corrections with: "Now update CLAUDE.md so you don't make that mistake again."

## Token Discipline
Response cap ≤350 tokens unless task demands more. Dispatch mechanical work (boilerplate, single-file refactor, bulk exploration) to `/ollama`; 3+ independent subtasks → parallel fan-out. Full routing: `docs/project-info/runbooks/TOKEN_DISCIPLINE.md`.
