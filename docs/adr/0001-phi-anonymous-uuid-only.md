# ADR 0001: PHI must use anonymous UUID only in analytics

**Status:** Accepted
**Date:** 2026-05-10
**Deciders:** Brady Grapentine

## Context

Carelog is a family caregiving coordination platform. The data flowing through the app — shift notes, medications, mood, screener results, journal entries — carries health context for the cared-for recipient. Even identifiers tied to a caregiver's account (email, phone, name) become PHI-adjacent the moment they are correlated with that recipient's care record.

Analytics platforms (PostHog today, potentially Segment / Amplitude / others later) ingest event streams from web and mobile and persist them in third-party storage. The default ergonomic call — `posthog.identify(user.email)` — would copy a real-world identifier into that store and turn analytics into a PHI sink. Once it lands there, removing it requires vendor cooperation and is rarely complete.

The repo already has multiple agents (Opus orchestrator, dispatched Sonnet subagents, `/ollama` workers) editing analytics-touching files in parallel. A single inattentive `posthog.identify(user.email)` from any of them would breach the boundary silently.

## Decision

`posthog.identify()` and `posthog.capture()` MUST use anonymous UUID only — never email, name, phone number, or any PII / PHI. This applies across every analytics platform (PostHog, Segment, Amplitude, or any future service) and every surface (web, mobile, future API or admin tooling).

Enforcement:

- Every subagent dispatch scope contract carries the explicit line: `PHI RULE: posthog.identify() and posthog.capture() must use UUID only — never email, name, or any PII`.
- Any subagent diff that touches a file importing an analytics SDK, or containing `identify` / `capture` calls, requires Opus diff review before merge.
- Treated as a hard invariant — no per-feature exceptions, no "just for debugging" overrides.

## Consequences

**Positive:**

- Analytics storage cannot become a PHI sink by accident.
- The rule is short enough to fit in every subagent scope contract, so it survives parallel-dispatch fan-out.
- Vendor switches (PostHog → Segment, etc.) inherit the same constraint without rewriting policy.

**Negative / accepted trade-offs:**

- Funnels and cohorts cannot pivot on real-world identity. Any user-targeted analysis goes through a separate, explicitly-audited path (e.g. server-side join against the application DB) rather than the analytics warehouse.
- Onboarding new analytics tooling requires an extra review step to confirm the UUID-only contract is honored end-to-end.
- A small ergonomic cost: developers must remember to look up the anonymous UUID rather than reach for `user.email`.

## Related

- `.claude/CLAUDE.md` § "PHI & Privacy Rules" — the operative rule that this ADR codifies.
- `.claude/CLAUDE.md` § "Subagent Scope Contract (required for every dispatch)" — where the PHI rule is enforced per-dispatch.
