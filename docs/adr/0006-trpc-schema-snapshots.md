# ADR-0006 — tRPC router Zod-schema snapshot tests

Date: 2026-05-19
Status: Accepted
Backlog: TD-197

## Context

Carelog uses tRPC for the web/mobile→server API contract. Compile-time tRPC types catch breaking changes within the monorepo but do not track which consumers (deployed web bundles, Expo OTA mobile builds) have actually re-shipped against a given server schema. Pact-style consumer-driven contract testing is the long-term answer (TD-196), but it pays off only once mobile splits from web on an independent OTA cadence.

The intermediate gap: a refactor that quietly drops a field from a router input/output schema can pass typecheck (callers in the monorepo update in lockstep), pass unit tests (which mock the procedure), and pass CI (which now skips E2E on docs-only and many internal-only diffs per TD-195 — once that lands). The change still breaks any consumer that hasn't redeployed.

## Decision

Ship a vitest spec at `apps/web/server/routers/__tests__/schema-snapshot.test.ts` that walks the entire `appRouter`, converts each procedure's Zod input + output schemas to JSON Schema via `zod-to-json-schema`, and compares the result to a checked-in baseline at `__snapshots__/api-schemas.snap.json`. The spec fails on any diff. Refreshing the baseline requires running with `UPDATE_SCHEMA_SNAPSHOT=1` and committing the new JSON — making API drift explicit and reviewable.

Schema changes that are intentional require both:
1. Bumping `apps/web/server/api-version.ts`'s `API_VERSION` (semver — PATCH for additive optional, MINOR for additive required with consumer defaults, MAJOR for removal/shape change), AND
2. Refreshing the baseline.

The walker covers query/mutation/subscription procedures and recurses into nested sub-routers. Input/output schemas only — middleware, RLS scoping, and runtime error codes are out of scope (pgTAP + E2E own those).

## Known-lossy patterns (intentional limits)

`zod-to-json-schema` cannot fully represent a few Zod constructs. These appear in the baseline as their best-effort approximation and won't catch every drift inside them. Documented here so contributors understand when to add a sibling unit test:

- **`z.record(z.unknown())`** — collapses to `{ type: "object" }` with no key/value schema. Heavily used by `careEvents` for the `data` payload. A new required field added inside the record won't show up as drift. *Mitigation: care_events writer paths have pgTAP coverage; new structured fields should be promoted out of `data` into typed columns.*
- **`z.lazy(() => ...)`** — recursive schemas serialize as `{}` (no introspection). *Mitigation: avoid recursive Zod in API surface; flatten or paginate.*
- **`z.brand(...)`** — brands are stripped at runtime. Branded types appear as their underlying schema. *Mitigation: brands are author-time discipline, not wire-contract guarantees.*

## Why not Pact today?

`apps/mobile` currently ships in lockstep with `apps/web` via the same monorepo client. There is no async consumer/provider relationship to test. Pact-style infrastructure (broker, consumer publishes, provider verification) is half-a-day of setup plus ongoing maintenance — premature until mobile starts independent Expo OTA updates that ship without a web redeploy. At that point revisit TD-196 and migrate from this snapshot suite to the broker-driven model.

## Consequences

- Every router schema change now shows up in PR diffs as a `__snapshots__/api-schemas.snap.json` change — reviewers can scan for unintentional removals.
- The walker runs in every CI bucket except docs-only (it's a vitest spec, no external deps beyond `zod-to-json-schema`). When TD-195 ships, this preserves contract-drift coverage on PRs where conditional E2E skips.
- Known-lossy patterns mean the suite is not exhaustive — it catches *most* drift, not all. Acceptable for the intermediate window before Pact.

## References

- TD-197 (this row)
- TD-195 — conditional E2E gating (sibling work; this ADR's existence is partially justified by TD-195 reducing E2E coverage)
- TD-196 — Pact contract testing (Deferred; this snapshot suite is its precursor)
- `apps/web/server/routers/__tests__/test-helpers/schema-walker.ts` — walker implementation
- `apps/web/server/api-version.ts` — bump-protocol anchor
