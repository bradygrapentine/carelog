# Dependency Freshness Report

**Generated:** 2026-04-14  
**Command:** `pnpm outdated -r` + `pnpm audit --prod`  
**Scope:** All workspaces (`apps/web`, `apps/mobile`, `packages/*`)  
**Note:** This is a report only — no versions were bumped.

---

## 1. Security Advisories (`pnpm audit --prod`)

**Summary: 4 vulnerabilities — 2 high, 1 moderate, 1 low**

| Severity | Package | Vulnerable | Patched | Advisory |
|---|---|---|---|---|
| **High** | `@xmldom/xmldom` | `<0.8.12` | `>=0.8.12` | [GHSA-wh4c-j3r5-mjhp](https://github.com/advisories/GHSA-wh4c-j3r5-mjhp) — XML injection via unsafe CDATA serialization |
| **High** | `next` | `>=16.0.0-beta.0 <16.2.3` | `>=16.2.3` | [GHSA-q4gf-8mx6-v5v3](https://github.com/advisories/GHSA-q4gf-8mx6-v5v3) — Denial of Service with Server Components |
| **Moderate** | `follow-redirects` | `<=1.15.11` | `>=1.16.0` | [GHSA-r4q5-vmmm-2653](https://github.com/advisories/GHSA-r4q5-vmmm-2653) — Custom auth headers leaked on cross-domain redirect |
| **Low** | `@tootallnate/once` | `<3.0.1` | `>=3.0.1` | Incorrect control flow scoping |

### Triage Notes

- `next` (High): Current pinned version is `16.2.1`. Patched at `16.2.3`. Minor patch — upgrade is low risk. Blocked only by `eslint-config-next` peer dep (also lags at `16.2.1`). **Action:** bump both together.
- `@xmldom/xmldom`: Transitive dep (likely via `@react-pdf/renderer` or similar). Check `pnpm why @xmldom/xmldom` before upgrading — may self-resolve with a `@react-pdf/renderer` bump.
- `follow-redirects`: Transitive dep. Low exploitability in this context (no server-side redirect-following on user-controlled URLs). Non-urgent.
- `@tootallnate/once`: Transitive, low severity. No direct action needed.

---

## 2. Version Lag by Category

### 2a. Major version lags (breaking changes likely)

| Package | Current (wanted) | Latest | Workspace(s) | Notes |
|---|---|---|---|---|
| `zod` | 3.25.76 | **4.3.6** | schemas, mobile, web | Zod v4 is a significant API change (new `.parse` semantics, tree-shaking). Migration effort ~half-day. |
| `typescript` | 5.9.3 | **6.0.2** | all | TS 6 has breaking changes (strict null, module resolution). Audit before upgrade. |
| `inngest` | 3.52.7 | **4.2.2** | web | v4 is a rewrite with new SDK shape. Non-trivial migration. |
| `posthog-node` | 4.18.0 | **5.29.2** | web | v5 changed client instantiation. Check PHI/identify rules still hold. |
| `resend` | 2.1.0 | **6.11.0** | web | 4 major versions behind. Resend v3+ changed domain/from handling. |
| `eslint` | 9.39.4 | **10.2.0** | web | ESLint 10 has config changes. Low urgency — ESLint 9 flat config already adopted. |
| `expo-camera` | 14.1.3 | **55.0.15** | mobile | SDK 55 upgrade. Requires matching Expo SDK bump across all `expo-*` packages. |
| `expo-image-manipulator` | 12.0.5 | **55.0.15** | mobile | Same — SDK 55 cohort upgrade. |
| `expo-secure-store` | 13.0.2 | **55.0.13** | mobile | Same. |
| `@react-native-community/netinfo` | 11.5.2 | **12.0.1** | mobile | Major bump; check RN peer compat. |
| `@react-native-community/datetimepicker` | 8.6.0 | **9.1.0** | mobile | Major bump. |
| `react-native-reanimated` | 4.1.7 | **4.3.0** | carelog | Minor within v4 but check for breaking API changes. |
| `@expo/html-elements` | 0.10.1 | **55.0.3** | carelog | SDK 55 cohort. |
| `tailwindcss` | 3.4.19 | **4.2.2** | carelog, web | **Already on Tailwind v4 in web** (via `@tailwindcss/postcss`). Root/carelog workspace still pins v3 — dedupe risk. |

### 2b. Minor / patch lags (low risk, safe to update)

| Package | Current (wanted) | Latest | Workspace(s) |
|---|---|---|---|
| `next` | 16.2.1 | **16.2.3** | web |
| `eslint-config-next` | 16.2.1 | **16.2.3** | web |
| `@react-pdf/renderer` | 4.4.0 | **4.4.1** | web |
| `prettier` | 3.8.1 | **3.8.2** | carelog |
| `react` / `react-dom` | 19.2.0 | **19.2.5** | mobile, web |
| `@base-ui/react` | 1.3.0 | **1.4.0** | web |
| `@playwright/test` | 1.58.2 | **1.59.1** | carelog |
| `@supabase/supabase-js` | 2.100.1 | **2.103.0** | mobile, web |
| `@supabase/ssr` | 0.10.2 | (latest) | web |
| `@tanstack/react-query` | 5.95.2 | **5.99.0** | mobile, web |
| `@trpc/client` / `react-query` / `server` | 11.13–11.15 | **11.16.0** | mobile, web |
| `posthog-js` | 1.367.0 | **1.368.2** | web |
| `turbo` | 2.8.20 | **2.9.6** | carelog |
| `@types/node` | 20.19.37 | **25.6.0** | web |

### 2c. "missing" entries

All packages show `Current: missing (wanted X.Y.Z)`. This is because `pnpm outdated -r` ran without a full `node_modules` install in this worktree. The "wanted" version is the pinned version in `package.json`; "latest" is the npm registry head. No packages are uninstalled in the real environment — this is a worktree artifact.

---

## 3. Recommended Upgrade Order

Priority is: security patches first, then safe minors that affect multiple workspaces, then major version work as coordinated efforts.

### Tier 1 — Do immediately (security patches)
1. **`next` + `eslint-config-next`** → `16.2.3` — fixes High DoS advisory. Patch-level change.
2. **`@xmldom/xmldom`** — resolve via `pnpm why @xmldom/xmldom`, then upgrade the parent dep. If direct, bump to `>=0.8.12`.

### Tier 2 — Safe patch/minor updates (bundle together)
3. `@react-pdf/renderer` 4.4.0 → 4.4.1
4. `prettier` 3.8.1 → 3.8.2
5. `react` / `react-dom` 19.2.0 → 19.2.5
6. `@supabase/supabase-js` 2.100.1 → 2.103.0 (both web + mobile)
7. `@tanstack/react-query` 5.95.2 → 5.99.0
8. `@trpc/*` 11.13–11.15 → 11.16.0
9. `posthog-js` 1.367.0 → 1.368.2 (verify no PHI capture changes)
10. `turbo` 2.8.20 → 2.9.6
11. `@playwright/test` 1.58.2 → 1.59.1

### Tier 3 — Planned major migrations (schedule separately)
12. **Expo SDK 55 cohort** (`expo-camera`, `expo-image-manipulator`, `expo-secure-store`, `@expo/html-elements`, `@react-native-community/*`) — coordinate with mobile-side changes; requires physical device QA.
13. **`zod` 3 → 4** — audit all `.parse`/`.safeParse` call sites; `@carelog/schemas` package is the primary consumer.
14. **`resend` 2 → 6** — review transactional email templates; v3+ changed `from` address domain handling.
15. **`inngest` 3 → 4** — new event-bus SDK shape; all `inngest/` function files need updating.
16. **`posthog-node` 4 → 5** — check PHI scrubbing in server-side capture calls.
17. **`typescript` 5 → 6** — after all other major migrations; run full typecheck + test suite.
18. **`tailwindcss` root/carelog v3 → v4** — deduplicate with the web workspace which already runs v4.

---

## 4. Other Notes

- `@types/node` current pinned at `20.x`; latest is `25.x`. Type-only dep; safe to bump but verify no Node API type breaks in `apps/web`.
- `react-native-reanimated` 4.1.7 → 4.3.0 is within v4; check changelogs for animation API changes before bumping.
- `@base-ui/react` 1.3.0 → 1.4.0: minor; review release notes for any breaking prop changes on primitives used in shadcn wrappers.
