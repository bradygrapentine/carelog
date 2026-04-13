> **Historical (2026-04-09)**: references Codex integration, which has since been replaced with `superpowers:dispatching-parallel-agents` + `/ollama` dispatch. See `.claude/CLAUDE.md` current routing guide.

---
title: Harness Enhancements
date: 2026-04-09
status: approved
---

# Harness Enhancements

Full-spectrum improvement to the Claude Code harness: friction fixes, new automation hooks, a new MCP server, a new skill, and doc updates.

---

## Scope

Six areas:

1. **Hook changes** — ESLint on edit, Stop hook for session summaries, PreToolUse Bash guard
2. **context-mode fix** — already done (rebuilt `better-sqlite3` against Node.js v25.3.0)
3. **CODEX_CONTEXT.md refresh** — stale test count + phase description
4. **Sentry MCP server** — official `@sentry/mcp-server` wired into global settings
5. **Mobile/Expo skill** — new project-level skill for `apps/mobile/` work
6. **Documentation updates** — HARNESS.md, USING_THE_HARNESS.md

---

## 1. Hook Changes

### PostToolUse — add ESLint

**File:** `.claude/settings.json`

Extend the existing `PostToolUse` matcher (`Edit|Write`) to also run ESLint on the edited file after the tsc check. Parse the file path from stdin JSON. Scope to `*.ts|*.tsx` files inside `apps/web/`. Run `eslint --quiet` on the single file to keep it fast.

The hook receives tool input via stdin as JSON with a `tool_input.file_path` field. Extract with `python3 -c "import sys,json; ..."`.

```json
{
  "matcher": "Edit|Write",
  "hooks": [
    {
      "type": "command",
      "command": "cd apps/web && output=$(npx tsc --noEmit 2>&1); if [ -n \"$output\" ]; then echo \"[tsc] $output\" | head -20; fi"
    },
    {
      "type": "command",
      "command": "cd apps/web && output=$(npx eslint --cache --quiet . 2>&1 | head -15); if [ -n \"$output\" ]; then echo \"[eslint] $output\"; fi"
    }
  ]
}
```

### Stop hook — auto session summary

**File:** `~/.claude/settings.json`

Add a `Stop` hook that injects a `systemMessage` prompting Claude to write a session summary to memory before the session ends.

```json
"Stop": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "echo '{\"systemMessage\": \"Session ending. Write a session summary to memory now: what was built or fixed, key decisions made, any blockers. Use the Write tool to append to the dated memory file at ~/.claude/projects/.../memory/.\"}'"
      }
    ]
  }
]
```

### PreToolUse Bash guard — destructive pattern warning

**File:** `~/.claude/settings.json`

Add a `PreToolUse` hook on `Bash` that parses the command from stdin and warns on destructive patterns.

Patterns to match: `rm -rf`, `git reset --hard`, `git push --force`, `git push -f`, `DROP TABLE`, `git branch -D`, `git clean -f`.

```json
"PreToolUse": [
  {
    "matcher": "Bash",
    "hooks": [
      {
        "type": "command",
        "command": "CMD=$(python3 -c \"import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))\" 2>/dev/null); if echo \"$CMD\" | grep -qE '(rm -rf|git reset --hard|git push --force|git push -f|DROP TABLE|git branch -D|git clean -f)'; then echo '{\"systemMessage\": \"Destructive command detected. Confirm with the user before proceeding.\"}'; fi"
      }
    ]
  }
]
```

---

## 2. context-mode Fix

Already resolved. `better-sqlite3` rebuilt against Node.js v25.3.0 (MODULE_VERSION 141). Session restart required to pick up the fix.

No further action needed.

---

## 3. CODEX_CONTEXT.md Refresh

**File:** `CODEX_CONTEXT.md`

Two fields to update:

- **Test count:** 279 → 452 (50 test files, 452 tests as of 2026-04-09)
- **Current phase:** Update from "Phase 3 complete. Before-launch items: Stripe, Sentry, PostHog, server-side auth migration" to reflect Wave 2 (history export) shipped; current focus is pre-launch infrastructure (Stripe billing, Sentry, PostHog, server-side auth migration).

---

## 4. Sentry MCP Server

**File:** `~/.claude/settings.json`

Add `@sentry/mcp-server` to the global `mcpServers` config.

```json
"sentry": {
  "command": "npx",
  "args": ["-y", "@sentry/mcp-server@latest"],
  "env": {
    "SENTRY_AUTH_TOKEN": "${SENTRY_AUTH_TOKEN}",
    "SENTRY_ORG": "${SENTRY_ORG}"
  }
}
```

**Required env vars** (add to `~/.zshrc`):
- `SENTRY_AUTH_TOKEN` — Sentry → Settings → Auth Tokens; scopes: `org:read`, `project:read`, `event:read`
- `SENTRY_ORG` — org slug (visible in Sentry URL: `sentry.io/organizations/<slug>/`)

**Dormant until** Sentry account + DSN are configured for the project (pre-launch task). Wiring it now means zero friction when that work starts.

**Usage:** Paste a Sentry issue ID into the session. Claude can pull full stack trace, breadcrumbs, affected users, and first/last seen — without leaving the session.

---

## 5. Mobile/Expo Skill

**File:** `.claude/skills/expo/SKILL.md`

A read-only reference skill invoked when working in `apps/mobile/`. Structured like the existing `test` and `review` skills.

### Sections:

**Navigation**
- Expo Router file-based routing; typed routes with `href`
- Deep link handling via `expo-linking`; OTP callback URL pattern
- Stack vs tab navigator defaults

**Styling**
- NativeWind for utility classes (same class names as Tailwind, different runtime)
- `StyleSheet.create` for dynamic styles that depend on runtime values
- No template literals restriction (Turbopack doesn't apply to Expo)

**Auth**
- No cookies — use `expo-secure-store` for token persistence
- OTP deep link callback: `carelog://auth/callback?token=...`
- No `createServerSupabase()` — browser client only via `createClient()`
- `useEffect` pattern for protected screens (same as web but no middleware)

**tRPC**
- Shared router from `packages/` — do not duplicate types
- Mobile client: `httpBatchLink`, not `httpLink`; no server component transport
- Auth header injection pattern for mobile requests

**Testing**
- No Vitest/jsdom for React Native components — use `jest-expo`
- Unit test business logic; skip component rendering tests for now (Expo SDK version instability)
- What to test: tRPC hook inputs/outputs, auth state transitions, navigation guards

**Rules (break things if ignored)**
- No `window`, `document`, or browser globals
- Expo SDK 52 — don't upgrade packages that pin to it without checking compatibility
- `expo-constants` for env vars, not `process.env` (except in metro config)
- EAS build: always update `app.json` version before submitting

---

## 6. Documentation Updates

### HARNESS.md

- Add `expo` row to skills table
- Add `sentry` row to MCP servers table (note: dormant until Sentry account configured)
- Remove stale note about context-mode Node.js issue (resolved)

### USING_THE_HARNESS.md

- Add `expo` to Skills invocation table: "Working in `apps/mobile/`"
- Update Hooks section to reflect three PostToolUse hooks (tsc + eslint), Stop hook, PreToolUse Bash guard
- Add Sentry to MCP Servers section with usage example

### CODEX_CONTEXT.md

- Covered in Section 3 above.

---

## Files Changed

| File | Change |
|------|--------|
| `.claude/settings.json` | Add ESLint to PostToolUse hook |
| `~/.claude/settings.json` | Add Stop hook, PreToolUse Bash guard, Sentry MCP server |
| `CODEX_CONTEXT.md` | Update test count + phase |
| `.claude/skills/expo/SKILL.md` | New file |
| `docs/project-info/claude/HARNESS.md` | Add expo skill + Sentry MCP row |
| `docs/project-info/claude/USING_THE_HARNESS.md` | Update hooks section + add expo + Sentry |

---

## Implementation Order

1. Hook changes (project + global settings)
2. CODEX_CONTEXT.md refresh
3. Expo skill
4. Sentry MCP config (note env vars needed)
5. Docs updates
