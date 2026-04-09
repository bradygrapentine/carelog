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

## Reference Docs (load on demand)

Linked from `.claude/CLAUDE.md`:

| Doc | Purpose |
|-----|---------|
| `docs/project-info/ARCHITECTURE.md` | Data model, system design, design rationale |
| `docs/project-info/ENTERPRISE_PRINCIPLES.md` | Hard-won coding rules (12 numbered principles) |
| `docs/project-info/UX_DECISIONS.md` | Language, tone, emotional framing decisions |
| `docs/project-info/TECH_DEBT.md` | Known issues before production |
| `docs/project-info/BUILD_STATUS.md` | What's done / in progress / next |
| `docs/project-info/PATTERNS.md` | Code conventions, testing patterns, git format |
| `docs/project-info/TROUBLESHOOTING.md` | Local dev fixes (Supabase, auth, Turbopack) |

## Additional Docs (not auto-loaded)

| Doc | Purpose |
|-----|---------|
| `docs/project-info/OVERVIEW.md` | Three-tier architecture diagram, client decision tree |
| `docs/project-info/AUTH_FLOW.md` | OTP flow, invite acceptance flow, session storage by layer |
| `docs/project-info/DATA_FLOW.md` | Care event write/read paths, identity resolution, invite paths |
| `docs/project-info/SECURITY_MODEL.md` | PHI boundary, service role isolation, RLS design, invite token security |
| `docs/project-info/INFRASTRUCTURE.md` | Why each third-party service was chosen |
| `docs/project-info/AGENT_WORKFLOW.md` | Agent and session workflow |
| `docs/project-info/DEPLOY.md` | Production deploy guide |
| `docs/project-info/PRODUCT_STRATEGY.md` | Product and business strategy |
| `docs/project-info/ROADMAP.md` | Product roadmap |
| `docs/project-info/BACKLOG_PHASE2.md` | Phase 2 backlog items |
