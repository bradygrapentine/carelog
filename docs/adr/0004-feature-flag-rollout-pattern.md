# ADR-0004: Feature Flag Rollout Pattern

**Status:** Accepted  
**Date:** 2026-05-14  
**Deciders:** Brady Grapentine  
**Related:** ADR-0001 (PHI anonymous UUID), TD-135

---

## Context

CareSync needs a safe rollout mechanism for new features — ship to 1 user, then 5,
then 50%, then everyone. PostHog feature flags provide this without a new dependency.
The central design question is whether distinctId (the user identifier sent to PostHog)
should be a parameter or derived internally.

## Decision

**`getFeatureFlag(flag: string): Promise<boolean>`** — no distinctId parameter.

The server-side helper derives distinctId internally from `supabase.auth.getUser()`.
This eliminates the PHI-leak surface: there is no caller-controlled slot that could
be (mis)used to pass `ctx.user.email` or any other PII. The existing
`carelog/no-phi-in-analytics` ESLint rule covers object literals; removing the
parameter means no second rule is needed for positional args.

Client-side: `useFeatureFlag(flag: string): boolean` wraps `useFeatureFlagEnabled`
from `posthog-js/react` with a fail-closed `?? false` default.

Both helpers fail-closed: any error (PostHog unreachable, no session) returns `false`.

## Rollout pattern

| Step | PostHog config | Duration |
|---|---|---|
| 1 | Allowlist single user UUID | Verify behaviour in prod |
| 2 | Allowlist 5 user UUIDs | Smoke across roles |
| 3 | 50% percentage rollout | Monitor errors for 48 h |
| 4 | 100% rollout | Stable — plan flag removal |

## Flag naming convention

`feature_<scope>_<feature>` — e.g. `feature_journal_ai_summary`, `feature_test_flag`.

Always create flags in the PostHog UI before referencing them in code (a missing flag
evaluates to `false` — safe, but noisy in tests).

## PHI invariant (ADR-0001 compliance)

`getFeatureFlag` uses `user.id` (anonymous UUID) as the PostHog distinctId.
Never pass `user.email`, `user.name`, or any PII to PostHog. This is a hard invariant.

## Bootstrap

`PostHogInit.tsx` passes `bootstrap: { featureFlags: {} }` to `posthog.init` so the
client does not flicker on first paint while flags load from PostHog's API.

## Rollback

Toggle the flag off in the PostHog UI. No deploy required. Takes effect within the
flag-cache TTL (~30 s client-side, immediate on server-side re-evaluation).

## Future work (out of scope)

- `getFeatureFlagAs(flag, targetUserId)` — admin-impersonation pattern for support
  tooling. Requires an admin-only RPC guard. Filed as follow-up TD.
- SSR flag bootstrap (inject flag state into the page on the server side for zero
  client-side fetch). Current ship is client-only evaluation.

## Consequences

- No PHI ever enters the flag evaluation path — no new lint rule required.
- Fail-closed means new code is always off-by-default until the flag is enabled.
- Flag removal requires a code PR + PostHog UI cleanup (no automated flag cleanup yet).
