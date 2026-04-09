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

## Reference Docs (load on demand)

- `docs/project-info/ARCHITECTURE.md` — data model, system design, design rationale
- `docs/project-info/ENTERPRISE_PRINCIPLES.md` — hard-won coding rules
- `docs/additional-project-info/UX_DECISIONS.md` — language and tone rules
- `docs/project-info/TECH_DEBT.md` — known issues before production
- `docs/project-info/BUILD_STATUS.md` — what's done / in progress / next
- `docs/project-info/PATTERNS.md` — code conventions, testing patterns, git format
- `docs/additional-project-info/TROUBLESHOOTING.md` — local dev fixes (Supabase, auth, Turbopack)

## Things Claude Should NOT Do

- Don't use `any` type without explicit approval
- Don't use server actions for auth/cookie operations — use API routes
- Don't mix `127.0.0.1` and `localhost` in Supabase URLs
- Don't auto-import large reference docs — list them, let user load on demand
- Don't claim done without running verification commands first
- Don't edit files during code review — only read and report findings

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
