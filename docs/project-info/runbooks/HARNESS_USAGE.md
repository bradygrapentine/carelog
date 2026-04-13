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

## 5. Common silent failure modes

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

## 6. Debugging checklist

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
