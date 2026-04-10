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
supabase test db        # RLS pgTAP tests
pnpm exec playwright test
```

## Code Style

- `type` over `interface`; no `enum` — use string literal unions
- No template literals in JSX props (Turbopack rejects them — compute URLs as variables)
- Auth: `createClient()` (browser) in `useEffect` for protected pages — not `createServerSupabase()`
- API routes (not server actions) for cookie-writing + redirect operations
- `supabaseAdmin` only in `server/` and `app/api/` — never client-side

## Plan Mode

- Start every complex task (3+ files) in plan mode
- Pour energy into the plan → 1-shot implementation
- When something goes sideways, re-plan — don't keep pushing

## Parallel Work

- Subagents only for genuinely independent tasks (different files, no shared state)
- Max 2 background agents per session
- Worktrees: `git worktree add .worktrees/<name> origin/main`

## Automation & Sessions

- `/loop` — run a skill on a recurring interval
- `/schedule` — schedule Claude on a cron, up to a week
- `/btw` — side query without interrupting current work

## Codex Commands

Codex runs with terminal access (`danger-full-access`) and command approval (`confirm`) by default.

- `/codex:rescue [prompt]` — delegate investigation or fix to Codex; supports `--resume`, `--fresh`, `--background`, `--effort`, `--model spark`
- `/codex:fix-tests [--unit|--rls|--e2e|--all]` — run failing tests and fix them with Codex; defaults to `pnpm test`
- `/codex:security-review` — PHI-boundary review: checks identity vault leaks, supabaseAdmin misuse, RLS correctness, auth bypasses; always runs at `--effort high`
- `/codex:adversarial-review [focus]` — challenge the implementation, design choices, and assumptions; supports `--path supabase/` to scope
- `/codex:review` — standard built-in code review
- `/codex:plan-review [plan-file]` — compare implementation diff against a plan in `docs/superpowers/plans/`; defaults to most recent plan
- `/codex:status` — check background job progress
- `/codex:result [job-id]` — fetch completed job output
- `/codex:cancel [job-id]` — cancel a running job

**When to use Codex vs Continue.dev:**
- Codex: multi-file implementation, test fixing, security review, tasks needing terminal access
- Continue.dev: autocomplete, inline edits <50 lines, single-file refactors, known-error debugging

## Reference Docs (load on demand)

- `docs/project-info/technology/ARCHITECTURE.md` — data model, system design, design rationale
- `docs/project-info/technology/ENTERPRISE_PRINCIPLES.md` — hard-won coding rules
- `docs/project-info/product/UX_DECISIONS.md` — language and tone rules
- `docs/project-info/technology/TECH_DEBT.md` — known issues before production
- `docs/project-info/product/BUILD_STATUS.md` — what's done / in progress / next
- `docs/project-info/technology/PATTERNS.md` — code conventions, testing patterns, git format
- `docs/project-info/technology/TROUBLESHOOTING.md` — local dev fixes (Supabase, auth, Turbopack)

## Things Claude Should NOT Do

- Don't use `any` type without explicit approval
- Don't use server actions for auth/cookie operations — use API routes
- Don't mix `127.0.0.1` and `localhost` in Supabase URLs
- Don't auto-import large reference docs — list them, let user load on demand
- Don't claim done without running verification commands first
- Don't edit files during code review — only read and report findings

## Code Reviews

- When asked to perform a 'review' or 'adversarial review': ONLY read and analyze code. Do NOT edit files or make implementation changes unless explicitly asked to fix issues afterward.
- When the user confirms 'Yes' or similar affirmation: treat it as confirmation of the previously proposed action — not as answering a question.

## General Rules

- When instructed to read docs or follow a specific document: read those files FIRST before exploring the codebase. Do not autonomously explore code when directed to consult documentation.
- Do not present option menus or ask clarifying questions when the user has given a clear, specific request. Execute directly. If the request names specific deliverables (e.g., 'create three runbooks'), produce them without stalling.

## Testing

pgTAP test rules (hard-won from past failures):
- `throws_ok` signature: use 3-arg form `throws_ok($$...$$, '...', 'message')` — NOT 4-arg
- `auth.users` FK constraints: insert into `auth.users` directly before inserting dependent rows, or use `supabase_test.create_supabase_user()`
- Never use DML (INSERT/UPDATE/DELETE) inside a subquery in pgTAP tests
- Enum columns: never CREATE TYPE inside a transaction — run migrations with `BEGIN; ... COMMIT;` outside pgTAP

## Self-Improvement

After every correction: update this file immediately.
End corrections with: "Now update CLAUDE.md so you don't make that mistake again."

## Plugin Priority

1. **memsearch** — recall memory before exploring codebase
2. **context-mode** — `ctx_execute` for output >20 lines; never Bash/Read for analysis
3. **superpowers** — invoke matching skill before any response
4. **frontend-design** — only for explicit UI/design requests
5. **codex** — fallback for isolated, well-scoped code generation

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