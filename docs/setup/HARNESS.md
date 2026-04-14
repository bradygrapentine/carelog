# Claude Code Harness — Reference Map

Everything configured in the harness: where it lives, what it does.
For the operational workflow guide, see `docs/project-info/runbooks/USING_THE_HARNESS.md`.

---

## Entry Points

| File | Scope | Purpose |
|------|-------|---------|
| `.claude/CLAUDE.md` | Project root | Master config — workflow, code style, plan mode, plugin priority, token discipline |
| `apps/web/CLAUDE.md` | Next.js app | Next.js 16 breaking changes, Turbopack rules, auth pattern, service role boundary |
| `apps/web/AGENTS.md` | Next.js app | Same rules in agent-compatible format (async params, proxy.ts, Turbopack) |
| `apps/mobile/CLAUDE.md` | Expo app | Offline queue, env vars, auth pattern |

---

## Local Skills

Invoke with `/skill-name` in Claude Code.

| Skill | Path | Purpose |
|-------|------|---------|
| `/create-migration` | `.claude/skills/create-migration/` | Scaffold Supabase migration + pgTAP test with hard-won rules baked in |
| `/review` | `.claude/skills/review/` | Adversarial security review — PHI leakage, IDOR, RLS, invite TOCTOU |
| `/plan-with-tests` | `.claude/skills/plan-with-tests/` | Ollama handoff plans with TDD verify steps |
| `/worktree-subagents` | `.claude/skills/worktree-subagents/` | Parallel subagents with isolated file state via git worktrees |
| `/ollama` | `.claude/skills/ollama/` | Dispatch parallel tasks to local Ollama models |
| `/expo` | `.claude/skills/expo/` | Expo/React Native patterns for `apps/mobile/` |
| `/session-end` | `.claude/skills/session-end/` | End-of-session: revise CLAUDE.md, save memory, check git |
| `/supabase-types` | `.claude/skills/supabase-types/` | Regenerate TypeScript types from local Supabase after migrations |

---

## Local Agents

| Agent | Location | Triggers |
|-------|----------|---------|
| `rls-reviewer` | `.claude/agents/rls-reviewer.md` | After writing migrations or `supabase/tests/` files. Verdicts: `Safe to commit` or `Do not commit — [reason]`. Never bypass a "do not commit" verdict without fixing the cited issue. |

---

## MCP Servers

| Server | Package | Purpose |
|--------|---------|---------|
| `playwright` | `@playwright/mcp` | Browser automation — drive the app visually during e2e testing |
| `supabase-local` | `@modelcontextprotocol/server-postgres` | Direct SQL against local Supabase (port 54322) |
| `github` | `@modelcontextprotocol/server-github` | PRs, issues, CI status — requires `GITHUB_PERSONAL_ACCESS_TOKEN` |
| `sentry` | `@sentry/mcp-server` | Pull Sentry issues and stack traces in-session — requires `SENTRY_AUTH_TOKEN` + `SENTRY_ORG`; dormant until Sentry account is configured |

---

## Reference Docs (load on demand)

| Doc | Purpose |
|-----|---------|
| `docs/project-info/technology/ARCHITECTURE.md` | Data model, system design, design rationale |
| `docs/project-info/technology/CODE_STANDARDS.md` | Hard-won coding rules, conventions, testing patterns, git format |
| `docs/project-info/product/UX_DECISIONS.md` | Language, tone, emotional framing decisions |
| `docs/project-info/technology/TECH_DEBT.md` | Known issues before production |
| `docs/project-info/product/BUILD_STATUS.md` | What's done / in progress / next |
| `docs/project-info/technology/TROUBLESHOOTING.md` | Local dev fixes (Supabase, auth, Turbopack) |
| `docs/project-info/runbooks/USING_THE_HARNESS.md` | Operational workflow guide — task routing, skills, dispatch, memory, token discipline |

## Additional Docs

| Doc | Purpose |
|-----|---------|
| `docs/project-info/product/OVERVIEW.md` | Three-tier architecture diagram, client decision tree |
| `docs/project-info/technology/AUTH_FLOW.md` | OTP flow, invite acceptance flow, session storage by layer |
| `docs/project-info/technology/DATA_FLOW.md` | Care event write/read paths, identity resolution, invite paths |
| `docs/project-info/technology/SECURITY_MODEL.md` | PHI boundary, service role isolation, RLS design, invite token security |
| `docs/project-info/technology/INFRASTRUCTURE.md` | Why each third-party service was chosen |
| `docs/project-info/runbooks/DEPLOY.md` | Production deploy guide |
| `docs/project-info/runbooks/MANUAL_TESTING.md` | QA testing for live website (web + mobile) |
| `docs/project-info/runbooks/THIRD_PARTY_SETUP.md` | External services, accounts, and infrastructure |
| `docs/project-info/runbooks/CODEBASE_EDUCATION.md` | Documentation reading path for new contributors |
| `docs/project-info/product/PRODUCT_STRATEGY.md` | Product and business strategy |
| `docs/project-info/product/ROADMAP.md` | Product roadmap |
| `BACKLOG.md` (repo root) | Master backlog — active, overnight queue, shipped log, deferred |

---

## Automated Hooks

Configured in `.claude/settings.json`.

### PreToolUse — runs before writes, can block

| Hook | Trigger | What it does |
|------|---------|-------------|
| `.env` guard | Any Edit/Write | Blocks edits to `.env*` files (allows `.env.example`) |
| Lock file guard | Any Edit/Write | Blocks edits to `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock` |
| iOS prebuild guard | Any Edit/Write | Blocks direct edits to `apps/mobile/ios/` except `Info.plist`, entitlements, `CarelogWatch/` |
| `supabaseAdmin` warn | Any Edit/Write | Prints a warning if you write `supabaseAdmin` outside `server/` or `app/api/` |
| PR security review | `gh pr create` | Prints a hint to invoke `/review` before the PR opens |

**Why each guard exists:**

- **`.env` guard** — Prevents accidentally committing secrets. Set real env vars directly in your shell or Vercel dashboard.
- **Lock file guard** — Lock files must be regenerated by the package manager. Run `pnpm install` instead.
- **iOS prebuild guard** — `apps/mobile/ios/` is fully generated by `expo prebuild --clean`. Direct edits are silently overwritten on next prebuild.
- **`supabaseAdmin` warn** — The admin client bypasses RLS. Accessing it outside server-trusted directories is a PHI boundary violation.

### PostToolUse — runs after writes, cannot block

| Hook | Files | What it does |
|------|-------|-------------|
| Web TypeScript check | Any file in `apps/web/` | Runs `npx tsc --noEmit`, prints first 20 errors |
| ESLint | Any file in `apps/web/` | Runs `npx eslint --cache --quiet`, prints first 15 warnings |
| Prettier | `.ts`, `.tsx`, `.js`, `.jsx` | Auto-formats the file in-place |
| Mobile TypeScript check | Any file in `apps/mobile/` | Runs `npx tsc --noEmit` in mobile, prints first 10 errors |
| pgTAP auto-run | Auth/RLS/migration files | Runs `supabase test db`; on failure prints an `/ollama` dispatch hint |

**pgTAP trigger keywords** — any of these in the file path triggers pgTAP:
`auth`, `rls`, `migration`, `policy`, `supabase/tests`

---

## Extending the Harness

### Add a PostToolUse hook

Open `.claude/settings.json`. Add to the `PostToolUse > Edit|Write > hooks` array:

```json
{
  "type": "command",
  "command": "python3 -c \"import sys,json; d=json.load(sys.stdin); fp=d.get('tool_input',{}).get('file_path',''); exit(0 if '<trigger-pattern>' in fp else 1)\" 2>/dev/null && <your-command> || true"
}
```

The `python3 -c` block gates execution by file path. `|| true` ensures hook failures don't block writes.

### Add a PreToolUse guard

```json
{
  "type": "command",
  "command": "python3 -c \"import sys,json; d=json.load(sys.stdin); fp=d.get('tool_input',{}).get('file_path',''); exit(1 if '<blocked-pattern>' in fp else 0)\" || (echo '[blocked] reason' && exit 2)"
}
```

Exit code 2 blocks the tool use. Exit code 0 allows it.

### Add a local skill

Create `.claude/skills/<skill-name>/index.md`. Claude picks it up automatically. Add an entry to the skills table in `.claude/CLAUDE.md`.

### Validate settings.json

```bash
python3 -c "import json; json.load(open('.claude/settings.json'))" && echo "valid"
```

---

## Verify the Harness Is Working

After changes to `.claude/settings.json`:

1. Edit any `.ts` file in `apps/web/` — you should see `[tsc]` output if there are errors
2. Edit any `.ts` file in `apps/mobile/` — you should see mobile tsc output if there are errors
3. Edit a file with a path containing `migration` — you should see `[pgTAP] Auth/RLS file changed...`
4. Try to edit `.env.local` — should be blocked with `[blocked] .env edit rejected`
5. Try to edit `pnpm-lock.yaml` — should be blocked with `[blocked] lock file edit rejected`
