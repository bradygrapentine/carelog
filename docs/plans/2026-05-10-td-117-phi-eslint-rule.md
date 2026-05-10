# TD-117 Implementation Plan — `no-phi-in-analytics` ESLint rule

**Date:** 2026-05-10
**Backlog:** TD-117 (P1)
**Codifies:** ADR-0001 (PHI must use anonymous UUID only in analytics)

## Why a custom ESLint rule (not a vitest test)

ESLint catches violations at write-time (Edit hook + CI lint), not test-time. Faster feedback loop, no risk of stale assertion against a moving call site list. ADR-0001 is a hard invariant — it deserves AST-level enforcement, not a snapshot diff.

## Scope

**Catches:** literal property keys in object literals passed to:
- `posthog.identify(distinctId, propertiesObject?)`
- `posthog.capture(eventName, propertiesObject?)`
- `Sentry.setUser(userObject)`
- `Sentry.setContext(name, contextObject)`

**Forbidden keys** (case-insensitive, exact match):
`email`, `phone`, `dob`, `ssn`, `first_name`, `last_name`, `full_name`, `address`, `zip`, `street`, `city`, `name` (special-cased — see below).

**Special case for `name`:** in Sentry contexts, "name" is sometimes legitimate metadata (e.g., browser name). The rule treats `name` as forbidden inside `posthog.identify` / `posthog.capture` properties only; ignored inside `Sentry.setContext` second arg.

**Recursion:** the rule walks nested object literals — `{ user: { email: 'x' } }` is caught.

**Limitations** (documented in rule message, not enforced):
- Spread elements (`{ ...userObj }`) — can't statically resolve. Reviewer must inspect.
- Variables (`const props = { email }; posthog.capture('e', props)`) — only literal-at-call-site is checked. Variable-flow analysis is out of scope.
- Computed keys (`{ [k]: v }`) — skipped, can't resolve.

## Files

- `apps/web/eslint-rules/no-phi-in-analytics.js` — the rule (CommonJS for ESLint compat).
- `apps/web/eslint-rules/index.js` — plugin export.
- `apps/web/eslint-rules/__tests__/no-phi-in-analytics.test.js` — vitest test using `RuleTester` from ESLint.
- `apps/web/eslint.config.mjs` — register the local plugin + add the rule with `error` severity.
- `.claude/CLAUDE.md` — one-line update to PHI rule pointing at the lint enforcement.
- BACKLOG.md untouched (per CLAUDE.md; `/backlog-sync` finds via conventional commit).

## Acceptance

- `cd apps/web && npx eslint app/ components/ server/ lib/ 2>&1 | grep no-phi-in-analytics` → 0 violations against existing code.
- Test file proves: rule fires on every forbidden key, ignores allowed keys (`org_id`, `id`, etc.), handles nested objects.
- Vitest pre-commit gate green.
- ESLint pipeline green.
- PR opens with a "this is the test that proves the rule works" link to the test file.

## Risk

- **Existing call site has a forbidden key.** Mitigation: the implementation phase will run the rule against the codebase and fix any flagged site (likely none given the 37-site grep showed only UUID + org_id, but verify).
- **False positive on legitimate semantic properties** (e.g., a `name` in a Sentry context that's NOT user identity). Mitigation: rule's special case for Sentry contexts; if a real false positive surfaces, allow `// eslint-disable-next-line no-phi-in-analytics` with a required justification comment (enforced by ESLint config option `reportUnusedDisableDirectives`).

## Out of scope

- Variable-flow analysis (would require type-aware linting).
- Server-side `posthog-node` calls (caught by same rule pattern via `posthog.capture` matching, but verify; if `posthog-node` uses different identifier, extend rule).
- Custom analytics wrappers (e.g., a project-local `analytics.track()` that proxies to PostHog) — file as TD-118 if such a wrapper exists or gets added.
