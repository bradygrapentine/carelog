# Carelog — Third-Party Setup Runbook

All external accounts and services needed to run Carelog in production.
Only actions that **require a human** (browser login, dashboard click-through, console signup) belong here — automated steps live in `DEPLOY.md`.

For the full deployment sequence (migrations, env vars, Vercel wiring) see `DEPLOY.md`.
For GitHub Actions billing, secrets, repo settings, and CI health see `CI_HEALTH.md`.

---

## Table of Contents

- [§1 Supabase](#1-supabase) — database, auth, HIPAA BAA
- [§2 Vercel](#2-vercel) — hosting, env vars, custom domain, SENTRY_AUTH_TOKEN
- [§3 Inngest](#3-inngest) — background jobs + cron
- [§4 Resend](#4-resend) — transactional email + domain verification
- [§5 Upstash Redis](#5-upstash-redis) — rate limiting
- [§6 Stripe](#6-stripe) — billing (live mode required)
- [§7 Sentry](#7-sentry) — error tracking + source maps
- [§8 PostHog](#8-posthog) — product analytics (PHI-safe)
- [§9 VAPID keys](#9-vapid-keys-web-push) — web push notifications
- [§10 Mobile: Firebase/FCM](#10-mobile-firebasefcm) — Android push
- [§11 Mobile: APNs](#11-mobile-apns-ios-push) — iOS push
- [§12 Mobile: deep-link verification files](#12-mobile-deep-link-verification-files) — AASA + assetlinks.json
- [§13 GitHub: billing, secrets, repo settings](#13-github-billing-secrets-repo-settings) — CI prerequisites (also see `CI_HEALTH.md`)
- [§14 Local dev: Playwright browser cache](#14-local-dev-playwright-browser-cache) — pre-commit hook prerequisite
- [§15 Final launch checklist](#15-final-launch-checklist)
- [§16 Account checklist at a glance](#16-account-checklist)
- [§17 Final launch dependencies (BACKLOG gates)](#17-final-launch-dependencies-backlog-gates)

---

## 1. Supabase

**What:** Postgres database + row-level security + auth + realtime.
**Why critical:** HIPAA BAA requires Pro plan. All PHI lives here. Without cloud keys, CI job `A2` cannot run.

### Create account and project

1. [supabase.com](https://supabase.com) → sign up → New project
2. Region: US East or US West (pick closest to users)
3. Set a strong database password — store in a password manager
4. Wait ~2 minutes for provisioning

### Apply migrations

```bash
supabase login          # interactive — must run in terminal, Claude cannot run this
supabase link --project-ref <your-project-ref>
supabase db push
```

**How to verify:** Table Editor in dashboard should show all tables (37 as of 2026-04 — count grows as migrations land; cross-check with `ls supabase/migrations/*.sql | wc -l`).

### Configure auth

1. Authentication → URL Configuration
2. Site URL: `https://care-log.org`
3. Redirect URL: `https://care-log.org/auth/callback`
4. Authentication → Email → OTP expiry: `600` seconds
5. Confirm email: **enabled**

**Phone OTP / Twilio:** Carelog uses **email OTP only** today — no SMS provider needed. If you ever enable phone auth, Supabase requires a Twilio account and `TWILIO_*` env vars. Skip for now.

**How to verify:** Send a test OTP — it arrives and expires in 10 minutes.

### Env vars

From Project Settings → API:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   ← never prefix with NEXT_PUBLIC_
```

### HIPAA BAA

Sign the BAA in Supabase dashboard before any real user data enters the system. Requires Pro plan.

**How to verify:** Dashboard → Settings → Billing → BAA status shows "Signed".

---

## 2. Vercel

**What:** Hosts the Next.js app + edge functions.
**Why critical:** Without it, no production app.

### Create account and project

1. [vercel.com](https://vercel.com) → New Project → Import Git Repository
2. Select the `carelog` repo
3. Root Directory: `apps/web`
4. Framework: Next.js (auto-detected)

### Supabase integration

1. Vercel → Integrations → Browse → Supabase → Add
2. Connect to your Supabase project
3. Verify it set `SUPABASE_SERVICE_ROLE_KEY` (not `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`)

### Add remaining env vars

> **⚠️ Prerequisite order:** Do **§1 Supabase → §3 Inngest → §4 Resend → §5 Upstash → §6 Stripe → §7 Sentry → §8 PostHog** *before* coming back to populate Vercel env vars. You'll need every key from those services in hand when you paste. The Vercel project itself can be created early (just leave env vars blank); `vercel deploy` will fail until they're filled.

Add each env var below after creating the corresponding downstream service.
Path: Vercel → Project → Settings → Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL           ← from Supabase (or auto-set by integration)
NEXT_PUBLIC_SUPABASE_ANON_KEY      ← from Supabase
SUPABASE_SERVICE_ROLE_KEY          ← from Supabase
NEXT_PUBLIC_APP_URL=https://care-log.org
NEXT_PUBLIC_POSTHOG_KEY            ← from PostHog
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ← from Stripe (live mode)
INNGEST_EVENT_KEY                  ← from Inngest
INNGEST_SIGNING_KEY                ← from Inngest
RESEND_API_KEY                     ← from Resend
RESEND_FROM_EMAIL=digest@care-log.org
UPSTASH_REDIS_REST_URL             ← from Upstash
UPSTASH_REDIS_REST_TOKEN           ← from Upstash
STRIPE_SECRET_KEY                  ← from Stripe (live mode)
STRIPE_WEBHOOK_SECRET              ← from Stripe webhook dashboard
STRIPE_PRICE_MONTHLY               ← Stripe Price ID for $14/mo
STRIPE_PRICE_ANNUAL                ← Stripe Price ID for $120/yr
SENTRY_DSN                         ← from Sentry
SENTRY_AUTH_TOKEN                  ← from Sentry auth tokens (build-time only — Production env only)
ANTHROPIC_API_KEY                  ← for AI brief generation (runtime)
NEXT_PUBLIC_VAPID_PUBLIC_KEY       ← generated locally (§9 below)
VAPID_PRIVATE_KEY                  ← generated locally (§9 below)
VAPID_EMAIL=admin@care-log.org
```

> **Not Vercel env vars:** `FCM_SERVER_KEY` and APNs `.p8` are stored as **EAS secrets**, not Vercel env vars (see §10–11). They never need to land in `.env*` for the web app.

**How to verify:** `vercel env pull` locally and confirm all vars appear in `.env.local`.

### SENTRY_AUTH_TOKEN in Vercel (unblocks TD-03)

**What:** Sentry build-time token for uploading source maps so stack traces are human-readable.
**Why critical:** Without it, Sentry shows minified/obfuscated stack traces — real production errors are nearly impossible to debug.
**Where:**
- Sentry: Settings → Auth Tokens → Create Token → scopes: `project:releases`, `org:read`
- Vercel: Project → Settings → Environment Variables → add `SENTRY_AUTH_TOKEN` → set Environment to "Production" only

**How to verify:** After the next Vercel build, open Sentry → Releases — the release should list source maps as attached. Stack traces in new errors will show original file/line numbers.

### Custom domain

1. Vercel → Project → Settings → Domains
2. Add `care-log.org` and `www.care-log.org`
3. Vercel will display a **CNAME** record (for `www.care-log.org`) and an **A** record (for `care-log.org` apex). Copy both.
4. At your domain registrar (GoDaddy / Namecheap / Cloudflare / etc.) → Domain → DNS settings:
   - Add or replace the apex `A` record with Vercel's IP
   - Add or replace the `www` `CNAME` to `cname.vercel-dns.com.`
   - Remove any conflicting records on the same hostname (registrars often pre-populate parking-page A records)
5. Wait 5–15 min for propagation. Refresh Vercel's Domains page until both rows show ✅ green.
6. Return to Supabase → Authentication → URL Configuration → update Site URL to `https://care-log.org`

**How to verify:** `curl -I https://care-log.org` returns 200 with `server: Vercel` headers and `x-vercel-id`.

---

## 3. Inngest

**What:** Background job orchestration — weekly digest, gap detector, refill alerts, OCR pipeline.
**Why critical:** Without Inngest, all scheduled jobs silently never fire. Families miss digest emails and medication refill warnings.

### Create account and app

1. [app.inngest.com](https://app.inngest.com) → sign up
2. Create App → name: `carelog`

### Get keys

1. Manage → Event Keys → Create Event Key → name: `carelog-production` → copy
2. Manage → Signing Keys → copy the Active Signing Key (`signkey-prod-...`)

### Env vars

```
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY
```

### Sync the serve endpoint (after first Vercel deploy)

1. Apps → Sync New App → URL: `https://care-log.org/api/inngest` → Sync
2. Verify these functions appear: `weekly-digest`, `gap-detector`, `refill-alert`, `ocr-prescription`

**How to verify:** Inngest dashboard → Functions — all four functions listed with status "Active".

---

## 4. Resend

**What:** Transactional email — invite emails and weekly digest.
**Why critical:** `onboarding@resend.dev` cannot be used for third-party apps. A verified domain is required before invites and digests will send. Unblocks BACKLOG item C3.

### Create account and API key

1. [resend.com](https://resend.com) → sign up
2. API Keys → Create API Key → name: `carelog-production`, permissions: Sending access → copy

### Verify domain

1. Domains → Add Domain → `care-log.org`
2. Add the provided DNS records (SPF, DKIM, DMARC) at your registrar
3. Wait for propagation (~15 min) → Verify

### Env vars

```
RESEND_API_KEY
RESEND_FROM_EMAIL=digest@care-log.org
```

### Smoke test

Sign in at the production URL. Invite email should arrive within 10 seconds.

**How to verify:** Resend dashboard → Emails shows delivered (not bounced or spam-filtered).

---

## 5. Upstash Redis

**What:** Rate limiting for OTP requests.
**Why critical:** Without it, the OTP endpoint is open to abuse. The app no-ops silently in local dev when env vars are absent — this is intentional, but production must have real rate limiting.

### Create account and database

1. [console.upstash.com](https://console.upstash.com) → sign up
2. Create Database → Redis → Regional → name: `carelog-prod`
3. Region: match your Vercel deployment region (Vercel → Project → Settings → General → Regions)
4. TLS: enabled (default)

### Get credentials

From the database dashboard → REST API section:

```
UPSTASH_REDIS_REST_URL    ← starts with https://
UPSTASH_REDIS_REST_TOKEN  ← long base64 string
```

**How to verify:** Make 6 rapid OTP requests. The 6th should return HTTP 429.

---

## 6. Stripe

> **Wire before launch** — webhook route + billing UI are fully implemented.
> `apps/web/app/api/stripe/webhook/route.ts`, checkout/portal/verify routes, and `apps/web/app/(app)/subscriptions/page.tsx` are all shipped. What remains is account-side configuration in live mode.

**What:** Billing — $14/mo or $120/yr family plan. Must be in live mode before any paying customers.

### Create account

1. [stripe.com](https://stripe.com) → sign up → activate live mode

### Create products

1. Products → Add Product → **Carelog Family Plan**
2. Add two prices:
   - Monthly: $14.00/month → copy Price ID → `STRIPE_PRICE_MONTHLY`
   - Annual: $120.00/year → copy Price ID → `STRIPE_PRICE_ANNUAL`

### Set up webhook

1. Developers → Webhooks → Add Endpoint
2. URL: `https://care-log.org/api/stripe/webhook`
3. Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
4. Copy Signing Secret → `STRIPE_WEBHOOK_SECRET`

### Env vars

```
STRIPE_SECRET_KEY                    ← live secret key
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   ← live publishable key
STRIPE_PRICE_MONTHLY
STRIPE_PRICE_ANNUAL
```

**How to verify (local dev only):** Install the Stripe CLI ([stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli) — `brew install stripe/stripe-cli/stripe` on macOS), then `stripe login`, then `stripe listen --forward-to localhost:3000/api/stripe/webhook` — trigger a test event in another terminal (`stripe trigger checkout.session.completed`) and confirm a 200 response is logged. Production uses the webhook URL configured in Stripe Dashboard → Webhooks → not the CLI.

---

## 7. Sentry

> **SDK is wired.** `sentry.{client,server,edge}.config.ts` and `@sentry/nextjs` are installed and configured with `sendDefaultPii: false`. What remains is account-side configuration (live DSN in Vercel + `SENTRY_AUTH_TOKEN` for source maps — see §2 above).

**What:** Error tracking. Must never capture PHI — Sentry only sees UUIDs, never real names.

### Create account and project

1. [sentry.io](https://sentry.io) → sign up → New Project → Next.js
2. Name: `carelog-web`
3. Copy DSN → `SENTRY_DSN`

### Source maps auth token

1. Settings → Auth Tokens → Create Token
2. Scopes: `project:releases`, `org:read`
3. Copy → `SENTRY_AUTH_TOKEN` → add to Vercel (Production env only — see §2)

### Privacy rule

Never add `user.name` or `user.email` to Sentry context. The identity vault tokenization ensures only UUIDs reach Sentry automatically. `sendDefaultPii: false` is already set in config.

**How to verify:** Trigger a test error in production; Sentry receives it with a human-readable stack trace (source maps working) and no PII in the user field.

---

## 8. PostHog

> **SDK is wired.** `posthog-js` is installed, `PHProvider` and `instrumentation-client.ts` are live. What remains is account-side key + privacy settings.

**What:** Product analytics. Must never receive real names — identify users by Supabase UUID only.

### Create account and project

1. [posthog.com](https://posthog.com) → sign up → New Project
2. Name: `carelog`
3. Copy Project API Key → `NEXT_PUBLIC_POSTHOG_KEY`

### Privacy settings

In PostHog project settings:
- Disable "Record user data" (IPs, user agent storage)
- Ensure person profiles are set to "identified_only" (matches app config)

### Env vars

```
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

**PHI rule:** Only `posthog.identify(user.id)` (UUID) — never email, name, or phone. This is enforced in code; the PostHog privacy setting is a defense-in-depth.

**How to verify:** PostHog → Live Events — sign in to the app, confirm events appear with UUID (not email) as the person identifier.

---

## 9. VAPID keys (web push)

**What:** VAPID key pair for browser Push API (web push notifications). PP-005 is shipped; this is the account-side setup.
**Why critical:** Without these, push subscription calls fail at runtime. Keys must be generated once per environment and never rotated without re-subscribing all users.

### Generate (one-time, local)

```bash
npx web-push generate-vapid-keys
```

Output:

```
Public Key:  BK...
Private Key: 4...
```

### Set in Vercel

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY   ← Public Key from above
VAPID_PRIVATE_KEY              ← Private Key from above
VAPID_EMAIL=admin@care-log.org ← change to your monitored email; receives subscription failure reports from push services
```

**How to verify:** Open the production app → browser console → no VAPID errors when the push subscription is established. Network tab shows a successful subscription POST.

---

## 10. Mobile: Firebase/FCM

**What:** Android push notification delivery via Firebase Cloud Messaging.
**Why critical:** Android devices cannot receive push without FCM credentials. Unblocks PP-007 live verification.

### Steps

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name `carelog`, disable Analytics
2. Add an **Android** app: package name `com.carelog.app` (must match `apps/mobile/app.json` → `android.package`)
3. Download `google-services.json` → save to `apps/mobile/google-services.json`
   > **Sensitive — handle as a credential.** It's already in `apps/mobile/.gitignore` (verify before committing). Keep a copy in your password manager. Do **not** check it into git.
4. Firebase → **Project settings** → **Cloud Messaging** → look for **Cloud Messaging API (Legacy)** and copy the **Server key**.
   > **If "Legacy API" is not visible / shows as disabled:** newer Firebase projects default to **HTTP v1 API only** (FCM Legacy was deprecated June 2024). For HTTP v1: skip the server-key step and follow [Firebase HTTP v1 setup](https://firebase.google.com/docs/cloud-messaging/migrate-v1) — Expo + EAS support both.
5. `eas secret:create --scope project --name FCM_SERVER_KEY --value "<server-key>"` (legacy) **or** create the v1 service-account secret per the Firebase HTTP v1 docs.
6. Verify `eas.json` sets `"googleServicesFile": "./google-services.json"` under `build.production.android`

**How to verify:** After EAS build, send a test notification from Firebase console → device receives it.

---

## 11. Mobile: APNs (iOS push)

**What:** Apple Push Notification service key for iOS push delivery.
**Why critical:** iOS push silently fails without a valid `.p8` key registered with EAS.

### Steps

1. [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles** → App ID `com.carelog.app` → enable **Push Notifications**
2. EAS dashboard → project → **Credentials** → **iOS** → **Add** → **Apple Push Notification Key (.p8)**
3. Alternative interactive flow: `eas credentials` in terminal (Claude cannot run this — must be run by human)

> **Sensitive — handle as a credential.** The `.p8` file Apple provides is **never** committed to git. EAS stores it server-side once you upload it. Keep a local copy + Key ID + Team ID in your password manager — Apple won't let you re-download the `.p8`, only generate a new one (which would invalidate the old one).

**How to verify:** Send a test push from the Expo dashboard or EAS; iOS device receives it.

---

## 12. Mobile: deep-link verification files

**What:** Apple App Site Association (AASA) and Android Asset Links files served from the production domain.
**Why critical:** Android App Links (PP-008) silently fall back to browser if `assetlinks.json` is wrong or missing. iOS universal links also require AASA. Unblocks PP-008.

### iOS AASA → `apps/web/public/.well-known/apple-app-site-association`

No `.json` extension. Get **Team ID** from [developer.apple.com](https://developer.apple.com) → Account → Membership.

```json
{
  "applinks": {
    "apps": [],
    "details": [{ "appID": "TEAMID.com.carelog.app", "paths": ["/invite/*"] }]
  }
}
```

### Android asset links → `apps/web/public/.well-known/assetlinks.json`

Get SHA-256 fingerprint after first EAS Android build: `eas credentials --platform android`.

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.carelog.app",
    "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
  }
}]
```

**How to verify:**

```bash
curl https://care-log.org/.well-known/apple-app-site-association
curl https://care-log.org/.well-known/assetlinks.json
```

Both should return JSON, not an HTML error page. Google also provides a [Statement List Tester](https://developers.google.com/digital-asset-links/tools/generator).

---

## 13. GitHub: billing, secrets, repo settings

> For full troubleshooting (symptom strings, step-by-step fixes), see `CI_HEALTH.md`. This section is the quick-reference version.

### 13a. GitHub Actions billing

**What:** GitHub bills for Actions minutes on private repos. A failed payment or hit spending limit hard-blocks every CI job.

**Symptom you'll see in Actions:**
```
This job was not started because recent account payments have failed
or your spending limit needs to be increased.
```

**Where to check:**
- Payment method: https://github.com/settings/billing/payment_information
- Spending limit: https://github.com/settings/billing/spending_limit

**How to fix:** Update payment method or increase spending limit. All queued jobs resume automatically once billing is healthy.

**How to verify:** Push a trivial commit; all CI jobs start within 30 seconds.

### 13b. ANTHROPIC_API_KEY GitHub secret

**What:** API key for the AI security review CI job (`.github/workflows/ci.yml` — the `ai-review` job). Every PR triggers this job via `scripts/ci-ai-review.mjs`.

**Why critical:** If missing or revoked, the `ai-review` CI job fails on every PR, preventing the auto-security-review that catches PHI leakage and RLS bypasses.

**Where to set:** GitHub → repository → Settings → Secrets and variables → Actions → New repository secret
- Name: `ANTHROPIC_API_KEY`
- Value: starts with `sk-ant-api03-...`

**How to verify:** Open a PR → CI → `AI security review` job completes and posts a review comment on the PR.

### 13c. Allow auto-merge

**What:** Repository setting that lets `gh pr merge --auto --squash` queue a merge to fire when CI goes green.

**Why critical:** When off (current state), agent-opened PRs cannot be auto-merged. Every PR requires manual merge after CI passes, creating a manual bottleneck for overnight/unattended work.

**Where to enable:** GitHub → repository → Settings → General → Pull Requests → check "Allow auto-merge"

**How to verify:** Run `gh pr merge --auto --squash <PR-number>` — should succeed with no error.

### 13d. Branch protection on `main`

**Current state:** `main` allows `gh pr merge --admin` without required reviews or status checks. This is permissive — convenient for fast iteration but risky for production.

**Recommended posture (pre-launch):** Keep as-is for velocity. Add required status checks (typecheck + web-tests) once CI is reliably green (after TD-14 is shipped).

**Recommended posture (post-launch):**
- Required status checks: `typecheck`, `web-tests`, `rls-tests`
- Require at least 1 approval for PRs from external contributors
- Do NOT require approval for Brady's own PRs (keeps solo-dev velocity)
- Allow admin override for emergencies: `gh pr merge --admin <number>`

**Where to configure:** GitHub → repository → Settings → Branches → Branch protection rules → Edit rule for `main`

---

## 14. Local dev: Playwright browser cache

**What:** Chromium binary used by Vitest browser tests (the pre-commit hook runs these).
**Why critical:** New dev machines / fresh clones hit a hard error if Chromium is missing:
```
Error: browserType.launch: Executable doesn't exist at
/Users/<you>/Library/Caches/ms-playwright/chromium-*/chrome-mac/Chromium.app/...
```

The pre-commit hook runs `cd apps/web && npx vitest run` — if Chromium is missing, **every commit fails** even when code is correct.

### Install (one-time per machine)

```bash
cd apps/web && npx playwright install chromium
```

CI installs Chromium automatically via `.github/workflows/ci.yml` step `Install Chromium for browser tests`. Local machines do not.

**How to verify:**

```bash
cd apps/web && npx playwright install chromium --dry-run
```

Should print the installed path, not "Executable doesn't exist".

---

## 15. Final launch checklist

- [ ] Supabase HIPAA BAA signed
- [ ] All tables migrated to Supabase cloud (37 as of 2026-04 — count grows with new migrations; verify `select count(*) from information_schema.tables where table_schema = 'public';` matches local)
- [ ] Vercel deploy green, all env vars set (see §2 full list)
- [ ] Custom domain resolving + SSL active
- [ ] Resend domain verified, test email delivered
- [ ] Inngest synced, all functions visible, weekly digest test run passes
- [ ] Upstash rate limiter active (6th OTP → 429)
- [ ] Stripe live-mode keys set, webhook endpoint registered
- [ ] Sentry DSN live, source maps uploading (`SENTRY_AUTH_TOKEN` in Vercel)
- [ ] PostHog key live, privacy settings confirmed (UUID-only identity)
- [ ] VAPID keys generated and set in Vercel
- [ ] Auth flow: OTP → dashboard working end-to-end
- [ ] Invite flow: invite sent → accepted → member appears in team
- [ ] GitHub Actions billing healthy (see §13a)
- [ ] `ANTHROPIC_API_KEY` GitHub secret set (see §13b)
- [ ] Allow auto-merge enabled if overnight agents will be used (see §13c)

---

## 16. Account checklist

| Service  | Purpose                 | Free tier OK?                 | Required for launch |
| -------- | ----------------------- | ----------------------------- | ------------------- |
| Supabase | Database, auth, storage | No — Pro required (HIPAA BAA) | Yes                 |
| Vercel   | Hosting, edge functions | Yes                           | Yes                 |
| Inngest  | Background jobs, cron   | Yes                           | Yes                 |
| Resend   | Transactional email     | Yes (3,000/mo)                | Yes                 |
| Upstash  | Redis rate limiting     | Yes (10,000 req/day)          | Yes                 |
| Stripe   | Billing — $14/mo plan   | No — live mode for launch     | Pre-launch          |
| Sentry   | Error tracking          | Yes                           | Yes                 |
| PostHog  | Product analytics       | Yes (1M events/mo)            | Yes                 |

---

## 17. Final launch dependencies (BACKLOG gates)

Items that **block** Claude-executable stories in `BACKLOG.md`:

| Dependency | Blocks |
|---|---|
| Supabase cloud keys | `A2` — `supabase link` + `db push` + bucket create + `supabase test db` against cloud |
| Resend verified domain | `C3` — update weekly digest FROM address to `notifications@<verified-domain>` |
| `assetlinks.json` served + EAS build SHA-256 | `PP-008` — Android app-links verification |
| `google-services.json` in EAS | `PP-007` — Android push notification verification |
| APNs `.p8` key in EAS | iOS production push builds |
| `SENTRY_AUTH_TOKEN` in Vercel | `TD-03` — source maps upload on each production build |
| `ANTHROPIC_API_KEY` GitHub secret | AI security review CI job on every PR |
| GitHub Actions billing healthy | Every CI job (see `CI_HEALTH.md`) |
