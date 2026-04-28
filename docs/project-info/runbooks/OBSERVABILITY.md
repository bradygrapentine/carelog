# Carelog — Observability & Monitoring Runbook

Carelog has three core monitoring systems (TD-73/74/75) that watch for production errors, digest delivery failures, and E2E test health. This runbook covers how to verify they're working, triage alerts, and respond to failures.

---

## Table of Contents

- [§1 Sentry: Error tracking + source maps](#1-sentry-error-tracking--source-maps)
- [§2 Rate-limit monitoring (TD-73)](#2-rate-limit-monitoring-td-73)
- [§3 Weekly digest delivery monitor (TD-74)](#3-weekly-digest-delivery-monitor-td-74)
- [§4 E2E green-streak gate (TD-75)](#4-e2e-green-streak-gate-td-75)
- [§5 On-call rotation](#5-on-call-rotation)
- [§6 What to do when an alert fires](#6-what-to-do-when-an-alert-fires)

---

## 1. Sentry: Error tracking + source maps

### Setup

Sentry SDK is configured in three layers:

- **`apps/web/sentry.client.config.ts`** — Browser errors (React, fetch, user interactions)
- **`apps/web/sentry.server.config.ts`** — Server-side errors (tRPC, API routes, Inngest functions)
- **`apps/web/sentry.edge.config.ts`** — Edge middleware + session refresh

All three use `sendDefaultPii: false` — no email, name, or real user identifiers are sent to Sentry. Only UUIDs are captured for user context.

### DSN (Data Source Name)

**Environment variable:** `SENTRY_DSN` in Vercel
**Vercel path:** Project → Settings → Environment Variables → `SENTRY_DSN`

The DSN is read from the environment at **runtime**. If it's missing, the SDK silently disables (no errors are captured, no noise in logs).

**How to verify:** Navigate to `https://care-log.org/sentry-example-page` (or trigger an error in the app). Wait ~5 seconds. Check [Sentry Issues](https://sentry.io/organizations/carelog-org/issues/) — a new issue should appear.

### Source maps (TD-03 — unblocks human-readable stack traces)

**What:** When the Next.js build runs in Vercel, JavaScript is minified. Without source maps, stack traces show minified function names and obfuscated line numbers. Source maps let Sentry re-map errors back to the original TypeScript source.

**How it's uploaded:**

1. At Vercel build time, `@sentry/nextjs/build` plugin is invoked (configured in `next.config.ts`).
2. The plugin creates a release, uploads the source maps, and injects the release ID into the app.
3. Sentry receives the source maps with the release and attaches them to that version.
4. On the next error, Sentry looks up the release ID and uses the maps to decode the stack trace.

**Environment variable:** `SENTRY_AUTH_TOKEN` (Vercel, Production env only)
**Vercel path:** Project → Settings → Environment Variables → `SENTRY_AUTH_TOKEN` → set to "Production" only

**How to get the token:**

1. Go to [sentry.io](https://sentry.io) → Organization → Settings → Auth Tokens
2. Create a token with scopes: `project:releases` + `org:read`
3. Copy the full token (it starts with `sntrys_...`)
4. Paste into Vercel as described above
5. Wait for the next Vercel build to complete (or force one with `vercel deploy --prod`)

**How to verify:** 

1. Open [Sentry Releases](https://sentry.io/organizations/carelog-org/releases/).
2. Find the latest release (timestamp matching your last Vercel deployment).
3. Click into it — the "Artifacts" section should list source maps for `sentry.client.js`, `sentry.server.js`, and edge chunks.
4. Click on an error in a recent issue → stack trace should show original TypeScript filenames and line numbers (not `t.jsx:1:2345`).

### Alert routing

**Default:** All errors route to the Sentry dashboard. No email/Slack alerts are configured by default.

**To add routing:**

1. Go to [Sentry Alerts](https://sentry.io/organizations/carelog-org/alerts/alerts/).
2. Create an alert rule: "When an issue is first seen" or "When an issue resolves".
3. Set the condition and action (Slack channel, email, PagerDuty, etc.).

**Suggested rule:** Create an issue on GitHub when any production error is first seen, or post to a `#production-errors` Slack channel. This keeps ops visibility high.

---

## 2. Rate-limit monitoring (TD-73)

**Current status:** Stub (monitoring infrastructure in place, but data pipeline not yet wired).

### What it does

The `rateLimit429Monitor` function runs every 5 minutes and checks for HTTP 429 rate-limit errors on:

- `/api/auth/*` (OTP endpoints)
- `/api/trpc/*` (data mutations)

When the 429 rate exceeds 1% of total requests in a 5-minute window, it fires a Sentry alert.

### Current limitation

Carelog does not yet have a table that records HTTP-level status codes and endpoint names. The monitor is a stub that:

1. Logs to Vercel function logs (visible in `vercel logs`)
2. Records a `cron_runs` row so the function appears in dashboards
3. Returns `{ status: 'stub', reason: 'missing rate_limit_events table' }`

### What's needed (follow-up TD)

To enable live rate-limit monitoring, create a pipeline that:

1. Captures HTTP 429 events from Vercel (via [Log Drain](https://vercel.com/docs/logs/log-drains) or function middleware)
2. Writes them to a `rate_limit_events` table with columns: `endpoint`, `status_code`, `occurred_at`
3. Replace the stub in `apps/web/inngest/functions/rateLimit429Monitor.ts` with the real query (see comments in that file)

### How to check the stub is running

1. Go to [Inngest dashboard](https://app.inngest.com) → Functions → `rate-limit-429-monitor`
2. Runs should appear every 5 minutes with status "Completed"
3. Click into a run → the output will show `{ status: 'stub' }`

This confirms the monitoring infrastructure is working. Once the `rate_limit_events` table exists, turn off the stub with one code change.

---

## 3. Weekly digest delivery monitor (TD-74)

**Current status:** Live (monitoring active).

### What it does

The `digestDeliveryMonitor` function runs every **Sunday at noon UTC** (4 hours after the digest send window) and:

1. Counts the total number of organizations in the database
2. Checks whether the `weekly-digest` Inngest function ran successfully in the current ISO week
3. If success rate < 80%, fires a Sentry alert (with message like "Digest delivery failed for 30% of orgs")

### Thresholds

- **Healthy:** Digest ran at least once this week, all orgs covered (100% success)
- **Unhealthy:** Digest didn't run this week, or returned an error

**Idempotency:** Alert is keyed by week stamp (e.g., `digest-monitor:2026-W17`), so only one alert per week even if the monitor runs multiple times.

### How to verify it's working

**In Inngest:**

1. Go to [Inngest dashboard](https://app.inngest.com) → Functions → `digest-delivery-monitor`
2. Runs should appear once a week (Sundays at 12:00 UTC)
3. Click into the most recent run → it should show:
   - `org_count`: total organizations
   - `success_count`: 0 or the org count (depending on whether digest ran)
   - No error output

**In the database:**

```sql
select function_id, last_ran_at, last_status, error_message
from cron_runs
where function_id = 'weekly-digest'
order by last_ran_at desc
limit 1;
```

This row should update every time `weekly-digest` runs (typically Sunday morning). The `last_status` should be `'ok'` if the digest sent successfully.

### What to do if the alert fires

1. Check Sentry for the alert message (look for "Digest delivery failed…")
2. Run the SQL query above to confirm digest didn't run
3. Check Inngest for the `weekly-digest` function:
   - Look for failed runs (red status)
   - Click into the most recent failure → read the error
4. Common causes:
   - **No organization data:** Org count is 0 (dev/test database). This is expected in staging.
   - **Digest function crashed:** Check the error in Inngest. Likely Resend API failure (email not sending) or database issue.
   - **Stale `last_ran_at`:** The digest ran, but the `cron_runs` row wasn't updated. Check that `digestDeliveryMonitor` has permission to `upsert` the `cron_runs` table (RLS policy check).

---

## 4. E2E green-streak gate (TD-75)

**Current status:** Live (gates production deploys).

### What it does

A GitHub Actions job (`e2e-streak-gate`) runs **daily at 8am UTC** and:

1. Queries the GitHub Actions API for the last 5 nightly E2E workflow runs
2. Counts consecutive failures at the head (most recent run first)
3. **Exits with failure if >3 consecutive failures**, which blocks any `main`-branch deployment

**Threshold:** 3 consecutive failures. This means:

- ✅ 0–3 failures: gate passes, deploys allowed
- ❌ 4+ failures: gate blocks, manual override needed

### Where to find the job

**GitHub Actions:** [carelog/actions/workflows/e2e-streak-gate.yml](https://github.com/bradygrapentine/carelog/actions/workflows/e2e-streak-gate.yml)

**Workflow details:**
- Runs daily at `0 8 * * *` (8am UTC = 3am ET)
- Can also be triggered manually via `workflow_dispatch`
- Takes <1 min to complete

### How to verify it's passing

1. Go to the [e2e-streak-gate workflow runs](https://github.com/bradygrapentine/carelog/actions/workflows/e2e-streak-gate.yml)
2. The most recent run (from today) should have a ✅ green checkmark
3. Click into it → step "Check E2E green streak" should show:
   ```
   Last 5 completed runs (newest first):
     success    https://github.com/.../runs/12345
     success    https://github.com/.../runs/12346
     ...
   Consecutive failures at head: 0
   PASS: 0 consecutive failure(s) — within threshold of 3.
   ```

### What to do if the gate fails

**Symptoms:** You push to `main`, and CI shows a red ❌ on the `e2e-streak-gate` check. Merge is blocked.

**Steps:**

1. Go to the failed gate run and read the output. It will list the last 5 E2E runs and their statuses.
2. Navigate to the [e2e-nightly workflow](https://github.com/bradygrapentine/carelog/actions/workflows/e2e-nightly.yml) to see the actual error logs.
3. Triage:
   - **Flaky test:** If only 1–2 runs failed and recent runs pass, re-run the nightly. The streak should reset within 24 hours.
   - **Real regression:** If multiple consecutive nightly runs are failing, investigate the root cause before merging (check recent commits, code changes, test failures).
4. **Override (emergency only):** If you must deploy despite a broken E2E streak:
   - Manually trigger the `e2e-streak-gate` workflow with `workflow_dispatch`
   - Or temporarily disable the branch protection rule on `main` (Settings → Branches → Branch protection rules → Edit)
   - **Document why:** Add a comment to your PR explaining the override

**Prevention:** Always run `pnpm exec playwright test` locally before pushing to `main`. The nightly suite can be flaky due to timing or external service unavailability — catching real failures locally prevents wasted CI runs.

---

## 5. On-call rotation

**Current status:** TBD — populate after first rotation is set.

Once a rotation is established, document:

- Which Slack channel or tool manages the rotation (PagerDuty, Opsgenie, GitHub Issues, etc.)
- Escalation path (who to page if the primary on-call doesn't respond within 15 minutes)
- Handoff schedule (weekly, bi-weekly, etc.)
- On-call responsibilities:
  - Monitor Sentry for critical errors
  - Respond to digest delivery failures
  - Investigate E2E gate blocks before merging
  - Check Inngest logs for silent failures (functions marked "ok" but no output)

---

## 6. What to do when an alert fires

### General triage flow

1. **Acknowledge the alert** (in Sentry, PagerDuty, Slack, etc.)
2. **Check the error message** — read the full context (stack trace, request payload, user ID)
3. **Identify the impact**:
   - Is this a new regression? (Check recent commits with `git log --oneline -20` + `git blame <file>`)
   - How many users are affected? (Check Sentry issue stats — "Users affected")
   - Is the system down, or just degraded? (Check [Vercel deployment status](https://vercel.com/dashboard) and [Inngest health](https://app.inngest.com))
4. **Respond**:
   - If critical (auth broken, data loss risk): revert the bad commit immediately
   - If non-critical: create a GitHub issue, assign to the on-call engineer, and triage in standup
5. **Cross-link documentation:** If the error is related to Supabase auth network issues, refer to `docs/project-info/runbooks/SUPABASE_AUTH_NETWORKERROR.md` (Link target lands in a sibling PR — may not exist until merged)

### Sentry error + stack trace analysis

When you receive a Sentry alert:

1. **Click the issue in Sentry** → you'll see:
   - Stack trace (file + line number if source maps are uploaded)
   - Breadcrumbs (last 10 events leading up to the error: network requests, console logs, user actions)
   - Tags (environment, release, user ID, browser, etc.)
   - Affected users (count + list if <100)
2. **Read the breadcrumbs** — often the root cause is 5 events before the exception (e.g., a 500 from a dependency, then app tries to use the response)
3. **Check the release tag** (top right) — if it's an old release, the error may have already been fixed
4. **Replay (if available):** Sentry Session Replay shows the user's browser actions leading up to the error — click "Replays" tab

### Inngest function failures

When an Inngest monitor or cron function fails:

1. Go to [Inngest](https://app.inngest.com) → Functions
2. Find the failed function (e.g., `digest-delivery-monitor`)
3. Click into it → find the failed run (red status)
4. Read the **Output** tab — this shows:
   - The error message
   - Stack trace (if it's a thrown exception)
   - Partial execution state (which `step` failed, what data was computed so far)
5. **Common causes:**
   - **Database permission denied:** The function's RLS policy doesn't allow the query. Check `supabase/tests/rls/` for the policy definition.
   - **External API timeout:** Resend, Stripe, or Anthropic API timed out. Retry manually — usually succeeds on second attempt.
   - **Network partition:** Temporary Supabase outage or DNS issue. Check [Supabase status page](https://status.supabase.com).
6. **Retry:** In Inngest, click "Retry Run" — the function re-executes with the same input.

### GitHub Actions (E2E gate) failures

When the E2E gate blocks your deploy:

1. Go to [Actions](https://github.com/bradygrapentine/carelog/actions/workflows/e2e-streak-gate.yml)
2. Click the failed run → read the job output
3. The output will show which of the last 5 E2E runs failed (and their URLs)
4. Navigate to the failing nightly E2E run to see the actual test error
5. **Quick fix:** If it's a flaky test (passed on previous runs), just wait 24 hours for the streak to expire, or re-run the nightly manually to bump the oldest failure out of the 5-run window
6. **Real fix:** If multiple consecutive runs are failing, fix the root cause (see E2E_FAILURE_DIAGNOSIS.md) before attempting to merge

---

## See also

- `docs/project-info/runbooks/DEPLOY.md` — how to deploy a new release
- `docs/project-info/runbooks/E2E_FAILURE_DIAGNOSIS.md` — how to debug failing E2E specs
- `docs/project-info/runbooks/THIRD_PARTY_SETUP.md` — full setup for Sentry, Inngest, etc.
- `docs/project-info/technology/CODE_STANDARDS.md` — Inngest function patterns + error handling best practices
