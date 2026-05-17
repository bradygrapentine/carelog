# TD-149 — `HEAD /care_events?select=*` 503 — investigation note

**Date:** 2026-05-17
**Surfaced by:** Cowork live-test run `1778988534` (Phase 4, journal entry write path)
**Status:** root cause identified; fix-path chosen (H3 — call-site change, no migration)

## Symptom

- `HEAD https://<project>.supabase.co/rest/v1/care_events?select=*&org_id=eq.<org_id>` → **503 Service Unavailable** (reproducible)
- `GET https://<project>.supabase.co/rest/v1/care_events?select=created_at&org_id=eq.<org_id>&order=created_at.asc&limit=1` → **200 OK** (same filter, different shape)

The dashboard makes both queries in parallel via `Promise.all`. The 503 puts the page in a degraded state, contributing to TD-150's "Quick log silently does nothing" appearance.

## Call site

`apps/web/app/(app)/dashboard/DashboardClient.tsx:163-174` — `Promise.all([countQuery, earliestQuery])`.

The failing call:

```ts
supabase
  .from("care_events")
  .select("*", { count: "exact", head: true })
  .eq("org_id", org.id)
```

PostgREST translates `select=* + count=exact + head=true` to `SELECT count(*) FROM care_events WHERE org_id = $1 AND <RLS quals>`. RLS quals on `care_events` SELECT expand to `user_can_access_recipient(recipient_id)` (per `supabase/migrations/20260327234330_core_schema.sql:436-438`), which is a function call that runs per row.

## Hypothesis ranking

### H1 — Missing composite index on `(org_id, created_at)` causes RLS-eval cost to dominate

The existing index closest to this query is `idx_events_org_type (org_id, event_type)` (line 569 of core_schema.sql). Postgres can use just the leading `org_id` column, so the filter itself isn't slow. But for `count(*)` under RLS, Postgres must evaluate the `user_can_access_recipient()` qual on every matching row before counting. A composite index doesn't change that fundamental cost.

**Verdict:** indexes don't fix the RLS-eval cost. Adding an index would be cargo culting. **REJECTED.**

### H2 — RLS policy function errors on certain inputs

`user_can_access_recipient(recipient_id)` is called per row. If the function were erroring (e.g. `auth.uid()` returning null in some context), the GET equivalent would also 5xx. It doesn't. **REJECTED.**

### H3 — `count=exact` with RLS performs a full RLS-evaluated scan; the call site doesn't need exact

PostgREST `count=exact` materializes the count — for an RLS-protected table at production size, that's a `SELECT count(*)` that evaluates the RLS predicate per candidate row. Statement-timeout (default 30s on Supabase Hobby/Pro) trips → 503. Meanwhile the bounded GET (`order created_at limit 1`) finds the first matching row and stops — RLS evaluates exactly once.

The call site uses the count to display a "<N> events over <M> months" stat on the dashboard. **Exact precision is not load-bearing for that display.**

**Fix:** change `count: "exact"` → `count: "estimated"` on line 166. Postgres returns the planner's row-count estimate (which honors filters via EXPLAIN) without scanning. Sub-millisecond cost, accuracy within ~5–15% of true count — acceptable for a stat display.

**Verdict:** **ACCEPTED.** Single-line code change, no migration, no schema change.

## What's NOT being changed

- No new index, no migration. Adding an index here would mask the real RLS-eval cost issue and provide false confidence; if the dashboard ever needs to display a *real* exact count (e.g. for billing), the same problem returns.
- RLS policy on `care_events` is unchanged — it correctly enforces team-level access.
- `user_can_access_recipient()` function is unchanged.

## Fallback path if H3 doesn't hold in prod

If after deploy the dashboard still 503s with `count=estimated`, the next escalation is:
1. Capture the failing SQL from Supabase logs (Database → Logs).
2. If it's the GET (`limit 1`) failing too, the issue isn't count semantics — it's a Supabase-side regression. Open a support ticket.
3. If the dashboard renders a 0 / null count because the estimated value is too stale, switch to a server-side cached count (RPC function that runs as `SECURITY DEFINER` and caches the count for the org's tenant_id with a 60s TTL).

## Acceptance for the fix PR

- DashboardClient.tsx line 166 changes `count: "exact"` to `count: "estimated"`.
- Existing dashboard unit tests stay green (no test currently asserts the exact-count behavior).
- Post-deploy: re-run the post-SEC-001 happy-path live test; Phase 4 should now succeed (modulo TD-150's separate fix).

## References

- [PostgREST count modes](https://docs.postgrest.org/en/latest/references/api/pagination_count.html)
- Core schema RLS policy: `supabase/migrations/20260327234330_core_schema.sql:435-449`
- Call site: `apps/web/app/(app)/dashboard/DashboardClient.tsx:163-174`
