# Claude Code Harness Map

## Entry Points

| File | Scope | Purpose |
|------|-------|---------|
| `.claude/CLAUDE.md` | Project root | Master config — workflow, code style, plan mode, plugin priority, token discipline |
| `apps/web/CLAUDE.md` | Next.js app | Next.js 16 breaking changes, Turbopack rules, auth pattern, service role boundary |
| `apps/web/AGENTS.md` | Next.js app | Same rules in agent-compatible format (async params, proxy.ts, Turbopack) |
| `apps/mobile/CLAUDE.md` | Expo app | Offline queue, env vars, auth pattern |

## Skills

| Skill | Path | Purpose |
|-------|------|---------|
| `test` | `.claude/skills/test/SKILL.md` | pgTAP fixtures, Vitest patterns, Playwright helpers, Zod rules |
| `review` | `.claude/skills/review/SKILL.md` | Adversarial security review — PHI leakage, IDOR, RLS, invite TOCTOU |
| `plan-with-tests` | `.claude/skills/plan-with-tests/SKILL.md` | Continue.dev handoff plans with TDD verify steps |
| `worktree-subagents` | `.claude/skills/worktree-subagents/SKILL.md` | Parallel subagents with isolated file state via git worktrees |
| `ollama` | `.claude/skills/ollama/SKILL.md` | Dispatch parallel tasks to local Ollama models |
| `expo` | `.claude/skills/expo/SKILL.md` | Expo/React Native patterns for `apps/mobile/` — navigation, auth, styling, tRPC, testing |

## Parallel Subagents & Ollama Dispatch

Parallel subagents via `superpowers:dispatching-parallel-agents` are the primary background-work mechanism. Use `/ollama` for local model dispatch on mechanical/exploratory subtasks; keep Claude Code as the orchestrator.

| Task | Use |
|------|-----|
| Failing tests (batch fix) | `/ollama` with fix prompts per file |
| Security/RLS review | `/review` skill (parallel subagents) |
| Multi-file architecture | Claude Code (this agent) |
| Parallel boilerplate / exploration | `/ollama` |
| Known-pattern code gen in bulk | `/ollama` with `qwen3-coder` |
| Plan implementation check | Task subagent: diff HEAD vs `docs/superpowers/plans/<file>` |
| Migration + pgTAP scaffold | `/create-migration` |

## Reference Docs (load on demand)

Linked from `.claude/CLAUDE.md`:

| Doc | Purpose |
|-----|---------|
| `docs/project-info/technology/ARCHITECTURE.md` | Data model, system design, design rationale |
| `docs/project-info/technology/CODE_STANDARDS.md` | Hard-won coding rules, conventions, testing patterns, git format |
| `docs/project-info/product/UX_DECISIONS.md` | Language, tone, emotional framing decisions |
| `docs/project-info/technology/TECH_DEBT.md` | Known issues before production |
| `docs/project-info/product/BUILD_STATUS.md` | What's done / in progress / next |
| `docs/project-info/technology/TROUBLESHOOTING.md` | Local dev fixes (Supabase, auth, Turbopack) |

## MCP Servers

| Server | Package | Purpose |
|--------|---------|---------|
| `playwright` | `@playwright/mcp` | Browser automation — drive the app visually during e2e testing |
| `supabase-local` | `@modelcontextprotocol/server-postgres` | Direct SQL access to local Supabase (port 54322) |
| `github` | `@modelcontextprotocol/server-github` | PRs, issues, CI status — requires `GITHUB_PERSONAL_ACCESS_TOKEN` env var |
| `sentry` | `@sentry/mcp-server` | Pull Sentry issues and stack traces in-session — requires `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` env vars; dormant until Sentry account configured |

## Workflow Guide

| Doc | Purpose |
|-----|---------|
| `docs/project-info/claude/USING_THE_HARNESS.md` | **Start here** — task routing, skill invocation, parallel-subagent dispatch, hooks, memory, token discipline |

## Additional Docs (not auto-loaded)

| Doc | Purpose |
|-----|---------|
| `docs/project-info/product/OVERVIEW.md` | Three-tier architecture diagram, client decision tree |
| `docs/project-info/technology/AUTH_FLOW.md` | OTP flow, invite acceptance flow, session storage by layer |
| `docs/project-info/technology/DATA_FLOW.md` | Care event write/read paths, identity resolution, invite paths |
| `docs/project-info/technology/SECURITY_MODEL.md` | PHI boundary, service role isolation, RLS design, invite token security |
| `docs/project-info/technology/INFRASTRUCTURE.md` | Why each third-party service was chosen |
| `docs/project-info/claude/AGENT_WORKFLOW.md` | Agent and session workflow |
| `docs/project-info/runbooks/DEPLOY.md` | Production deploy guide |
| `docs/project-info/runbooks/MANUAL_TESTING.md` | QA testing for live website (web + mobile) |
| `docs/project-info/runbooks/THIRD_PARTY_SETUP.md` | External services, accounts, and infrastructure |
| `docs/project-info/runbooks/CODEBASE_EDUCATION.md` | Documentation reading path for new contributors |
| `docs/project-info/product/PRODUCT_STRATEGY.md` | Product and business strategy |
| `docs/project-info/product/ROADMAP.md` | Product roadmap |
| `docs/project-info/product/BACKLOG_PHASE2.md` | Phase 2 backlog items |
