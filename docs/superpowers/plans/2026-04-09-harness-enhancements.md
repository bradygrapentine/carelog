# Harness Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Claude Code harness with ESLint automation, session memory hooks, a Sentry MCP server, a mobile/Expo skill, and updated documentation.

**Architecture:** Config changes to project and global settings files, a new project-level skill, and updates to three docs. No application code changes. context-mode was already fixed in the session that produced this plan (better-sqlite3 rebuilt).

**Tech Stack:** Claude Code hooks (JSON shell commands), ESLint 9 flat config, `@sentry/mcp-server`, Markdown skill files.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `.claude/settings.json` | Modify | Add ESLint to PostToolUse hook |
| `~/.claude/settings.json` | Modify | Add Stop hook, PreToolUse Bash guard, Sentry MCP |
| `.gitignore` (root) | Modify | Add `.eslintcache` |
| `CODEX_CONTEXT.md` | Modify | Update test count + phase description |
| `.claude/skills/expo/SKILL.md` | Create | Mobile/Expo reference skill |
| `docs/project-info/claude/HARNESS.md` | Modify | Add expo skill + Sentry row |
| `docs/project-info/claude/USING_THE_HARNESS.md` | Modify | Update hooks section, add expo + Sentry |

---

## Task 1: Add ESLint to PostToolUse hook

**Files:**
- Modify: `.claude/settings.json`
- Modify: `.gitignore`

No tests — hook changes are verified manually by triggering a lint error.

- [ ] **Step 1: Add `.eslintcache` to root `.gitignore`**

Open `.gitignore` and add at the end:

```
.eslintcache
apps/web/.eslintcache
```

- [ ] **Step 2: Update `.claude/settings.json` to add ESLint hook**

Replace the full contents of `.claude/settings.json` with:

```json
{
  "hooks": {
    "PostToolUse": [
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
    ]
  }
}
```

- [ ] **Step 3: Verify ESLint hook fires correctly**

Edit any `.ts` file in `apps/web/` to introduce a temporary lint error, for example add an unused variable:

```ts
const _unused = 'trigger'
```

Save the file. The PostToolUse hook should surface output like:

```
[eslint] apps/web/some-file.ts
  1:7  warning  'unused' is assigned a value but never used  @typescript-eslint/no-unused-vars
```

Then revert the temporary change.

- [ ] **Step 4: Commit**

```bash
git add .claude/settings.json .gitignore
git commit -m "feat(harness): add ESLint to PostToolUse hook"
```

---

## Task 2: Add Stop hook and PreToolUse Bash guard to global settings

**Files:**
- Modify: `~/.claude/settings.json`

These are global settings — not committed to the repo.

- [ ] **Step 1: Read the current global settings**

```bash
cat ~/.claude/settings.json
```

- [ ] **Step 2: Add Stop hook and PreToolUse Bash guard**

The `hooks` section currently has `PreCompact` and `SessionStart`. Add `Stop` and `PreToolUse` alongside them. The full updated `hooks` block:

```json
"hooks": {
  "PreCompact": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "echo '{\"systemMessage\": \"About to compact. Save key decisions/blockers to memory now (Write tool). Run /context-mode:ctx-stats to see what context-mode saved.\"}'"
        }
      ]
    }
  ],
  "SessionStart": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "echo '{\"systemMessage\": \"Session start: recall relevant memory via memsearch before exploring codebase. Response cap: 350 tokens unless asked for more.\"}'"
        }
      ]
    }
  ],
  "Stop": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "echo '{\"systemMessage\": \"Session ending. Before stopping: use the Write tool to append a session summary to the dated memory file in ~/.claude/projects/.../memory/. Include: what was built or fixed, key decisions, any blockers. Keep it under 10 bullet points.\"}'"
        }
      ]
    }
  ],
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
}
```

Write the complete updated `~/.claude/settings.json` using the Write tool, preserving all existing keys (`enabledPlugins`, `extraKnownMarketplaces`, `mcpServers`, `model`).

- [ ] **Step 3: Verify the file is valid JSON**

```bash
python3 -m json.tool ~/.claude/settings.json > /dev/null && echo "valid JSON"
```

Expected: `valid JSON`

- [ ] **Step 4: No commit** — global file is outside the repo.

---

## Task 3: Add Sentry MCP server to global settings

**Files:**
- Modify: `~/.claude/settings.json`

- [ ] **Step 1: Add sentry to `mcpServers` in `~/.claude/settings.json`**

The existing `mcpServers` block has `playwright`, `supabase-local`, and `github`. Add `sentry`:

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

- [ ] **Step 2: Verify valid JSON**

```bash
python3 -m json.tool ~/.claude/settings.json > /dev/null && echo "valid JSON"
```

Expected: `valid JSON`

- [ ] **Step 3: Document required env vars**

Add to `~/.zshrc` (or wherever the user's shell exports live):

```bash
export SENTRY_AUTH_TOKEN=your_token_here
export SENTRY_ORG=your_org_slug_here
```

`SENTRY_AUTH_TOKEN`: Sentry → Settings → Auth Tokens → Create token. Scopes: `org:read`, `project:read`, `event:read`.
`SENTRY_ORG`: visible in Sentry URL — `sentry.io/organizations/<slug>/`.

Note: the MCP server will be dormant until these env vars are set and `source ~/.zshrc` is run. No action needed now if Sentry account isn't configured yet.

- [ ] **Step 4: No commit** — global file is outside the repo.

---

## Task 4: Update CODEX_CONTEXT.md

**Files:**
- Modify: `CODEX_CONTEXT.md`

- [ ] **Step 1: Update test count**

Find the line:

```
- `pnpm test` — Vitest (279 tests)
```

Replace with:

```
- `pnpm test` — Vitest (452 tests, 50 test files)
```

- [ ] **Step 2: Update current phase**

Find the line:

```
Phase 3 complete (medical, outer circle, care brief). Before-launch items: Stripe billing, Sentry, PostHog, server-side auth migration.
```

Replace with:

```
Phase 3 complete (medical, outer circle, care brief). Wave 2 complete (history export). Before-launch items: Stripe billing, Sentry, PostHog, server-side auth migration.
```

- [ ] **Step 3: Commit**

```bash
git add CODEX_CONTEXT.md
git commit -m "chore: update CODEX_CONTEXT with current test count and phase"
```

---

## Task 5: Create Expo skill

**Files:**
- Create: `.claude/skills/expo/SKILL.md`

- [ ] **Step 1: Create the skill directory and file**

Create `.claude/skills/expo/SKILL.md` with the following content:

```markdown
# Expo / React Native — Carelog Mobile

Reference skill for working in `apps/mobile/`. Invoke when editing Expo/React Native code.

**READ this before touching `apps/mobile/`.** Patterns here differ significantly from `apps/web/`.

---

## Navigation (Expo Router)

- File-based routing — `app/` directory maps to routes, same as Next.js App Router but for native screens
- Typed routes via `href` — use `router.push('/journal')` not bare strings where possible
- Stack navigator is the default; tabs live in `app/(tabs)/`
- Deep link pattern for OTP callback: `carelog://auth/callback?token=...`
  - Registered in `app.json` under `scheme: "carelog"`
  - Handle in the auth screen with `expo-linking` `useURL()` hook

```ts
import * as Linking from 'expo-linking'
const url = Linking.useURL()
// parse token from url on mount
```

---

## Styling

- **NativeWind** for utility classes — same class names as Tailwind web, different runtime
  - Use `className` prop on `View`, `Text`, `Pressable` etc.
  - No CSS-in-JS, no `style={{ }}` for static styles
- **`StyleSheet.create`** only for dynamic styles that depend on runtime values (e.g. animated values, layout measurements)
- No Turbopack restrictions here — template literals are fine in React Native props
- No `px`/`rem`/`vh` — dimensions are logical pixels; use `Dimensions` API for screen-relative sizing

---

## Auth

- **No cookies** — React Native has no cookie jar
- Token persistence: `expo-secure-store`

```ts
import * as SecureStore from 'expo-secure-store'
await SecureStore.setItemAsync('session', JSON.stringify(session))
const raw = await SecureStore.getItemAsync('session')
```

- OTP flow: send OTP → user taps link → app opens via deep link → exchange token
- Supabase client: `createClient()` (browser client) — same as web `useEffect` pattern
  - Do NOT use `createServerSupabase()` — no server context in React Native
- Protected screens: redirect in `useEffect` if no session, same pattern as web but no middleware

---

## tRPC

- Shared router lives in `packages/` — do not duplicate types or procedures
- Mobile client uses `httpBatchLink`, not server component transport:

```ts
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@carelog/api'

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/api/trpc`,
      headers: async () => ({
        authorization: `Bearer ${await getToken()}`,
      }),
    }),
  ],
})
```

- Auth header injection: read session token from SecureStore and attach as `Authorization: Bearer`

---

## Testing

- **No Vitest/jsdom** for React Native components — the DOM environment doesn't exist
- Use `jest-expo` for component tests if needed (currently skipped — Expo SDK instability)
- **What to test now:**
  - tRPC input/output shapes (pure logic, no component rendering)
  - Auth state transitions (token store read/write)
  - Navigation guard logic (extracted to pure functions)
- Run tests: `cd apps/mobile && pnpm test` (jest-expo)

---

## Rules — break things if ignored

1. **No `window` or `document`** — these don't exist in React Native; any web utility that uses them will crash
2. **Expo SDK 52** — don't upgrade packages that pin to it without checking compatibility matrix first
3. **Env vars:** use `expo-constants` (`Constants.expoConfig.extra`), not `process.env` (except in `metro.config.js`)
4. **EAS build:** always bump `version` in `app.json` before submitting to stores; EAS rejects duplicate versions
5. **Metro bundler** — not Turbopack; different caching behavior; run `expo start --clear` to bust cache after config changes
6. **Icons:** use `@expo/vector-icons`, not `lucide-react` (web) or `lucide-react-native` without verifying Expo SDK compatibility

---

## Quick Reference

| Web pattern | Mobile equivalent |
|-------------|------------------|
| `next/navigation` useRouter | `expo-router` useRouter |
| `document.cookie` / Supabase SSR | `expo-secure-store` |
| `middleware.ts` auth guard | `useEffect` redirect in screen |
| Tailwind `className` | NativeWind `className` |
| `process.env.NEXT_PUBLIC_*` | `Constants.expoConfig.extra.*` |
| Playwright e2e | Detox (not yet configured) |
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/expo/SKILL.md
git commit -m "feat(harness): add Expo/React Native skill"
```

---

## Task 6: Update documentation

**Files:**
- Modify: `docs/project-info/claude/HARNESS.md`
- Modify: `docs/project-info/claude/USING_THE_HARNESS.md`

- [ ] **Step 1: Update HARNESS.md skills table**

Find the skills table. It currently ends with:

```markdown
| `worktree-subagents` | `.claude/skills/worktree-subagents/SKILL.md` | Parallel subagents with isolated file state via git worktrees |
```

Add a new row:

```markdown
| `expo` | `.claude/skills/expo/SKILL.md` | Expo/React Native patterns for `apps/mobile/` — navigation, auth, styling, tRPC, testing |
```

- [ ] **Step 2: Update HARNESS.md MCP servers table**

Find the MCP servers table. It currently has `playwright`, `supabase-local`, `github`. Add:

```markdown
| `sentry` | `@sentry/mcp-server` | Pull Sentry issues and stack traces in-session — requires `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` env vars; dormant until Sentry account configured |
```

- [ ] **Step 3: Update USING_THE_HARNESS.md skills table**

Find the skills invocation table. Add:

```markdown
| `expo` | Working in `apps/mobile/` — navigation, auth, styling, tRPC, testing patterns |
```

- [ ] **Step 4: Update USING_THE_HARNESS.md hooks section**

Find the Hooks section. The PostToolUse entry currently describes only the tsc check. Update it to:

```markdown
- **PostToolUse on Edit/Write** → runs `npx tsc --noEmit` in `apps/web` and surfaces the first 20 lines of any type errors. Also runs `npx eslint --cache --quiet .` and surfaces the first 15 lines of lint errors. Both checks fire on every file edit — no need to run typecheck or lint manually during implementation.
```

Add a new entry under the hooks list for Stop and PreToolUse:

```markdown
- **Stop** → prompts Claude to write a session summary to the project memory file before the session ends. Captures: what was built/fixed, key decisions, blockers.
- **PreToolUse on Bash** → parses Bash commands for destructive patterns (`rm -rf`, `git reset --hard`, `git push --force`, `DROP TABLE`, `git branch -D`, `git clean -f`). Injects a confirmation reminder if matched.
```

- [ ] **Step 5: Update USING_THE_HARNESS.md Sentry section**

Find the MCP Servers section. After the GitHub server entry, add:

```markdown
### Sentry (`@sentry/mcp-server`)
Requires `SENTRY_AUTH_TOKEN` and `SENTRY_ORG` set in shell environment. Dormant until Sentry account is configured for the project (pre-launch task). Once active, use when:
- A Sentry alert fires — paste the issue ID and Claude pulls the full stack trace, breadcrumbs, affected users, and first/last seen without leaving the session
- Investigating a production error by issue ID or DSN project

**Setup:** Add to `~/.zshrc`:
```bash
export SENTRY_AUTH_TOKEN=your_token_here
export SENTRY_ORG=your_org_slug_here
```
Generate token at: Sentry → Settings → Auth Tokens (scopes: `org:read`, `project:read`, `event:read`).
```

- [ ] **Step 6: Commit**

```bash
git add docs/project-info/claude/HARNESS.md docs/project-info/claude/USING_THE_HARNESS.md
git commit -m "docs(harness): add expo skill, Sentry MCP, updated hooks documentation"
```

---

## Self-Review

**Spec coverage check:**
- [x] ESLint PostToolUse hook → Task 1
- [x] Stop hook → Task 2
- [x] PreToolUse Bash guard → Task 2
- [x] context-mode fix → already done (noted in architecture)
- [x] CODEX_CONTEXT.md refresh → Task 4
- [x] Sentry MCP server → Task 3
- [x] Mobile/Expo skill → Task 5
- [x] HARNESS.md updates → Task 6
- [x] USING_THE_HARNESS.md updates → Task 6
- [x] `.eslintcache` gitignore → Task 1

**Placeholder scan:** No TBDs. All commands are exact. Sentry env var setup is clearly documented as deferred (dormant until account configured).

**Type consistency:** No shared types — all config and Markdown.
