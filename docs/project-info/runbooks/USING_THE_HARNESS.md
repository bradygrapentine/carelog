# Using the Claude Harness

Operational guide for getting the most out of the Carelog Claude Code harness. `.claude/CLAUDE.md` is the canonical behavior spec — this doc explains how it works in practice and how to debug when it doesn't.

---

## 1. What the harness is

| Surface | Location | Purpose |
|---|---|---|
| Project CLAUDE.md | `.claude/CLAUDE.md` | Workflow, routing, subagent contract, PHI rules, plugin priority |
| App CLAUDE.md | `apps/web/CLAUDE.md`, `apps/mobile/CLAUDE.md`, `supabase/CLAUDE.md`, `e2e/CLAUDE.md` | Sub-tree-specific rules |
| UI standards | `.claude/rules/ui-standards.md` | Tailwind tokens, WCAG AA, responsive breakpoints |
| Skills | `.claude/skills/<name>/SKILL.md` | Loaded on `/<name>`; playbooks for specific tasks |
| Hooks | `.claude/settings.json` + `.claude/hooks/*.sh` | Shell commands fired on tool events |
| Routing manifest | `.claude/routing.yaml` | Archetype → model map (consulted by `/routing-report`) |
| Routing metrics | `.claude/routing-metrics.jsonl` (gitignored) | Every Agent dispatch logged by the PreToolUse hook |
| Memory | `~/.claude/projects/.../memory/` | Cross-session user/feedback/project/reference notes |

---

## 2. Session-start ritual

1. **Recall memory** — `memsearch` auto-loads; watch for `[memsearch] Memory available`.
2. **Read `BACKLOG.md` §0 + the relevant §1–§5 row.** Don't explore code to guess what's next.
3. **Run `/backlog-sync`** if the board looks stale (>1 day since last sync).
4. **Pre-flight** if the session will touch multi-file work — see §5.

The `SessionStart` hook posts a reminder.

---

## 3. Task routing — what handles the work

### Decision tree

```
Is this one story I can PR today?
  → /ship-story <STORY-ID>

Are there 2–6 independent tasks (backlog-driven)?
  → /backlog-dispatch

Are there 2–6 independent tasks (ad-hoc, not backlog)?
  → /dispatch

Mechanical / bulk boilerplate / 3+ parallel exploration?
  → /ollama

Multi-file architecture, RLS, or security judgment?
  → This session (Opus)

Security / adversarial review?
  → /review
```

### Model tier table

| Tier | Model | For |
|---|---|---|
| 1 | Opus (this session) | Architecture, security/RLS/PHI, plan authoring, final verification |
| 2 | Sonnet (Agent tool) | Multi-file implementation (2–6 files), moderate refactors |
| 3 | Haiku (Agent tool) | Single-file changes, known-pattern tests, code review |
| 4 | Ollama (`/ollama`) | Boilerplate, grep/glob, bulk parallel mechanical work |

The `route-model-log.sh` PreToolUse hook **blocks** Haiku >6000-char prompts and Opus-for-mechanical dispatches. Override: `CLAUDE_ALLOW_MODEL_MISMATCH=1`.

See `.claude/routing.yaml` for the full archetype map and `/routing-report` for weekly usage analysis.

---

## 4. Skills

Skills are invoked via `/<skill-name>`. Full list lives in `.claude/CLAUDE.md` § Project Skills. Highlights:

**Shipping work**
- `/ship-story <STORY-ID>` — single story end-to-end
- `/backlog-dispatch` — fan out against all 🟢 Ready rows
- `/dispatch` — ad-hoc parallel fan-out (not backlog-driven)
- `/tdd-ship <STORY-ID>` — strict red-green-refactor with 5-iteration budget

**Infrastructure**
- `/create-migration` — Supabase migration + pgTAP scaffold with hard-won rules
- `/schema-dump <tables>` — dump columns/indexes/RLS **before** writing any SQL
- `/supabase-types` — regen `database.types.ts` after a migration
- `/deploy-autopilot` — autonomous ship with rollback on smoke-test failure

**Operations**
- `/review` — adversarial security review (parallel subagents, read-only)
- `/test-gaps` — coverage gap analysis
- `/backlog-sync` — reconcile BACKLOG.md against git + PRs
- `/routing-report` — weekly analysis of `.claude/routing-metrics.jsonl`
- `/session-end` — cleanup, memory save, prompt-to-commit
- `/mobile-ui` — iOS simulator or Android emulator automation
- `/pre-flight` — pre-multi-step audit

Superpowers plugin (always on): `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `dispatching-parallel-agents`, `using-git-worktrees`, `finishing-a-development-branch`, `requesting-code-review`.

---

## 5. Hooks — what fires automatically

All in `.claude/settings.json` and `.claude/hooks/*.sh`. Each hook prefixes its output so you can spot it in scrollback.

### PreToolUse (can block)

| Hook | Trigger | Block condition | Override |
|---|---|---|---|
| **main-commit block** | `git commit` | Current branch is `main` | `CLAUDE_ALLOW_MAIN_COMMIT=1` |
| **Pre-commit tests** | `git commit` on a commit touching `apps/web/**/*.{ts,tsx,js,jsx}` | `vitest run` exits non-zero | — fix tests first |
| **route-model-log** | `Agent` tool | Haiku with >6000-char prompt **or** Opus on mechanical keywords (rename/stub/scaffold/format) | `CLAUDE_ALLOW_MODEL_MISMATCH=1` |
| **.env guard** | Edit/Write to any `*.env*` except `.env.example` | Always blocks | Edit manually |
| **Lock file guard** | Edit/Write to `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock` | Always blocks | Run `pnpm install` |
| **iOS prebuild guard** | Edit/Write under `apps/mobile/ios/` (except Info.plist, entitlements, `CarelogWatch/`) | Always blocks | Use `expo prebuild` |
| **supabaseAdmin warn** | Edit/Write containing `supabaseAdmin` outside `server/`, `app/api/`, `supabase/` | Warn only | — |
| **PR review hint** | Bash matching `gh pr create` | Warn only | — |
| **main-branch edit warn** | Edit/Write on `main` | Warn only | — |

### PostToolUse (diagnostic, never blocks)

| Hook | Trigger | Prefix | Silent-failure mode |
|---|---|---|---|
| **Web tsc** | Any Edit/Write | `[tsc]` | `apps/web` missing or tsc unresolvable |
| **Web ESLint** | Any Edit/Write | `[eslint]` | Cache corrupt — delete `apps/web/.eslintcache` |
| **Prettier** | `.ts`/`.tsx`/`.js`/`.jsx` | Silent on success | `\|\| true` swallows all errors |
| **Mobile tsc** | `apps/mobile/*.ts(x)` | tsc output | Same as web |
| **pgTAP** | Edit/Write to files matching `auth`/`rls`/`migration`/`policy`/`supabase/tests` | `[pgTAP]` then last 20 lines | Supabase not running → hangs |
| **related-test** | Edit/Write to `apps/web/*.ts(x)` source file (non-test) | `[related-test]` + test output | Silent on green; 30s timeout |
| **shadcn import check** | Edit/Write importing from `@/components/ui/<name>` | `WARNING: ... does not exist. Run: pnpm dlx shadcn@latest add <name>` | Regex-narrow; misses namespaced imports |
| **Card hint** | `.tsx` with raw `bg-white border rounded-xl shadow` | `HINT: Raw card div detected` | Race with fast edits |
| **Sidebar breakpoint reminder** | Sidebar/journal files without `md:` | `REMINDER: verify md: breakpoints` | Heuristic; false positives |

### Validate a hook manually

```sh
echo '{"tool_name":"Bash","tool_input":{"command":"git commit"}}' \
  | bash .claude/hooks/<script>.sh
```

Check `settings.json` is valid: `python3 -c "import json; json.load(open('.claude/settings.json'))"`.

---

## 6. Parallel work

Use worktrees when agents would edit the same files; use plain parallel Agent tool calls when they won't.

```sh
git worktree add .worktrees/<name> origin/main -b feat/<name>
# Symlink node_modules — much faster than `pnpm install` in the worktree:
ln -s $(pwd)/node_modules .worktrees/<name>/node_modules
ln -s $(pwd)/apps/web/node_modules .worktrees/<name>/apps/web/node_modules
```

Without the node_modules symlinks, the pre-commit hook fails in the worktree even on correct code — the hook runs `cd apps/web && npx vitest run` and needs the packages.

**Limits:** max 2 background Agent subagents at a time; `/ollama` scales higher (local).

**Subagent scope contract (required):**
```
FILES ALLOWED: [exact list]
BRANCH: <name> — verify with `git branch --show-current` before commit
DO NOT: features outside the ticket, PHI in analytics, commit to main
PHI RULE: posthog.identify/capture UUID only — never email/name
VERIFY: tests before commit; diff summary in response
```

---

## 7. MCP servers

User-level (`~/.claude/mcp.json` or `claude mcp add`). Active in this project:

- **github** — PR management, issue search
- **supabase-local** — Postgres queries against local Supabase (`localhost:54322`)
- **playwright** — browser automation
- **chrome-devtools-mcp** — LCP, a11y, network inspection
- **context7** — live library docs
- **context-mode** — sandbox for large tool outputs
- **sentry** — stack traces, events, releases (requires `SENTRY_AUTH_TOKEN`)
- **posthog** — analytics queries (requires auth)

MCP server config belongs in `.mcp.json` or `~/.claude/mcp.json`, **not** `settings.json` (which is hooks/permissions only).

---

## 8. Memory

Lives at `~/.claude/projects/-Users-bradygrapentine-projects-carelog/memory/`. Four types:

| Type | What to save |
|---|---|
| `user` | Role, preferences, expertise level |
| `feedback` | Corrections and *confirmed* approaches — with a **Why:** line |
| `project` | Ongoing work, decisions, deadlines, motivations |
| `reference` | Where external info lives (Linear projects, Grafana boards) |

**Don't save:** code patterns, file paths, git history, debugging recipes — those are derivable. Save the *why*, not the *what*. Verify before acting on a memory — it may be stale.

---

## 9. Debugging checklist

When something feels off:

1. **Did a hook fire?** Search scrollback for its prefix (`[tsc]`, `[eslint]`, `[pgTAP]`, `[blocked]`, `[routing]`, `[related-test]`).
2. **Is `settings.json` valid?** `python3 -c "import json; json.load(open('.claude/settings.json'))"`.
3. **Run the hook manually** with synthetic JSON on stdin (see §5).
4. **Which branch?** `git branch --show-current` — concurrent Claude instances can switch branches under you; re-check immediately before every commit.
5. **What's in context?** System-reminder blocks in the transcript list loaded CLAUDE.md files, skills, and MCP tools.
6. **Is the skill current?** `.claude/skills/<name>/SKILL.md` — skills auto-invoke only when the user request matches the description.
7. **Permission denied?** The Bash command pattern isn't in `permissions.allow` — add it or run interactively.
8. **Ollama stalled?** `curl -sf http://localhost:11434/api/tags`; if it fails, `ollama serve`.
9. **Tests fail only after commit?** Worktree is missing `node_modules` symlinks — see §6.

---

## 10. Common silent failures

| Symptom | Cause | Fix |
|---|---|---|
| `ctx_execute` returns nothing | Node version drift in context-mode | `/context-mode:ctx-upgrade` |
| Subagent committed to `main` | Scope contract missing branch name | Always pass branch; hook now blocks main commits |
| `/ollama` dispatch stalls | Local Ollama not running | `ollama serve` or use `glm-4.7:cloud` |
| Prettier "didn't format" | `\|\| true` swallowed error | Run `npx prettier --write <file>` manually |
| pgTAP hook hangs | Supabase not started | `supabase start` |
| ESLint silent on real errors | Cache corrupt | `rm apps/web/.eslintcache` |
| Pre-commit tests pass but CI fails | `vitest --changed` in hook only covers `apps/web/`; mobile/packages change passes gate trivially | Run `cd apps/mobile && npx vitest run` manually before commit |
| Stale `[tsc]` errors | Old build state from another branch | `rm -rf apps/web/.next apps/web/tsconfig.tsbuildinfo` |
| Haiku call blocked by route-model hook | Prompt >6000 chars | Retry with `model: sonnet` or set `CLAUDE_ALLOW_MODEL_MISMATCH=1` |
| Main commit blocked | Policy | Branch off (`git checkout -b feat/<name>`) or set `CLAUDE_ALLOW_MAIN_COMMIT=1` for an intentional docs/backlog-sync commit |

---

## 11. Lessons from production use

**Subagent scope drift** — a dispatched agent added unrelated features + committed to main. Fix: the scope contract in §6 is non-negotiable; the main-commit hook now enforces the branch rule.

**Explore-instead-of-deliver** — review/runbook sessions stalled reading files. Fix: for any artifact request, **create the output file first with section headers**, then fill section by section.

**Environment blockers mid-session** — Docker not running, wrong branch, IDE reverts. Fix: pre-flight before multi-step work:
```sh
git branch --show-current && git status --short && docker ps | grep supabase
```

**Worktree no-tests failure** — worktrees lack `node_modules` by default; pre-commit hook fails. Fix: symlink from main repo (§6).

---

## See also

- `.claude/CLAUDE.md` — canonical routing, plugin priority, PHI rules
- `.claude/routing.yaml` — archetype → model manifest
- `BACKLOG.md` §0 — status board (always current via `/backlog-sync`)
- `docs/project-info/technology/TROUBLESHOOTING.md` — local dev issues (Supabase, Turbopack, auth)
