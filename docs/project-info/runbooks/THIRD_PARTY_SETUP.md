# Carelog — Third-Party Setup Runbook

All external accounts and services needed to run Carelog in production. Follow in order — each service may depend on the one before it.

For the full step-by-step deployment guide (migrations, env vars, Vercel wiring), see `DEPLOY.md`.

---

## Account Checklist

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

## 1. Supabase

**Why:** Postgres database + auth + realtime. HIPAA BAA requires Pro plan.

### Create account and project

1. [supabase.com](https://supabase.com) → sign up → New project
2. Region: US East or US West (pick closest to users)
3. Set a strong database password — store in a password manager
4. Wait ~2 minutes for provisioning

### Apply migrations

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Verify: Table Editor in dashboard should show all 16 tables.

### Configure auth

1. Authentication → URL Configuration
2. Site URL: `https://care-log.org`
3. Redirect URL: `https://care-log.org/auth/callback`
4. Authentication → Email → OTP expiry: `600` seconds
5. Confirm email: **enabled**

### Env vars

From Project Settings → API:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   ← never prefix with NEXT_PUBLIC_
```

### HIPAA BAA

Sign the BAA in Supabase dashboard before any real user data enters the system. Requires Pro plan.

---

## 2. Vercel

**Why:** Hosts the Next.js app. Supabase integration auto-wires env vars.

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

See `DEPLOY.md` Step 2c for the full list. Add after creating each downstream service (Inngest, Resend, etc.).

### Custom domain

1. Vercel → Project → Settings → Domains
2. Add `care-log.org` and `www.care-log.org`
3. Update DNS at registrar with Vercel's CNAME/A records
4. Return to Supabase → Authentication → URL Configuration → update Site URL to `https://care-log.org`

---

## 3. Inngest

**Why:** Background job orchestration — weekly digest, gap detector, refill alerts, OCR pipeline.

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

---

## 4. Resend

**Why:** Transactional email — OTP delivery handled by Supabase, but invite emails and weekly digest go through Resend.

**Critical:** `onboarding@resend.dev` cannot be used for third-party apps. A verified domain is required before invites and digests will send.

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

---

## 5. Upstash Redis

**Why:** Rate limiting for OTP requests. No-ops silently in local dev when env vars are absent.

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

### Smoke test

Make 6 rapid OTP requests. The 6th should return 429.

---

## 6. Stripe

> **FUTURE WORK — DO NOT CONFIGURE YET**
> The webhook route `/api/stripe/webhook` does not exist. The billing UI is not built. The schema columns (`stripe_id`, `plan`) are in place but no code handles Stripe events. Configuring a webhook endpoint now will result in silent 404s on every subscription event. Return to this section only after the billing feature is implemented and the webhook route is wired.

**Why:** Billing — $14/mo or $120/yr family plan. Must be in live mode before launch.

**Status:** Billing UI not yet built. Keys are in place; the `organizations.stripe_id` and `organizations.plan` columns exist in the schema. Wire billing before any paying customers.

### Create account

1. [stripe.com](https://stripe.com) → sign up → activate live mode

### Create products

1. Products → Add Product → **Carelog Family Plan**
2. Add two prices:
   - Monthly: $14.00/month → copy Price ID
   - Annual: $120.00/year → copy Price ID
3. Store both Price IDs for when billing UI is wired

### Set up webhook

1. Developers → Webhooks → Add Endpoint
2. URL: `https://care-log.org/api/stripe/webhook`
3. Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
4. Copy Signing Secret

### Env vars

```
STRIPE_SECRET_KEY                    ← live secret key
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   ← live publishable key
```

---

## 7. Sentry

> **FUTURE WORK — DO NOT CONFIGURE YET**
> `@sentry/nextjs` is not installed in the codebase. There is no `sentry.client.config.ts`, `sentry.server.config.ts`, or Sentry instrumentation in `next.config.ts`. Creating a Sentry project now will produce a DSN that is never used. Return to this section only after `@sentry/nextjs` is added and the SDK is wired into the app.

**Why:** Error tracking. Must never capture PHI — Sentry only sees UUIDs, never real names.

### Create account and project

1. [sentry.io](https://sentry.io) → sign up → New Project → Next.js
2. Name: `carelog-web`
3. Copy DSN

### Source maps (build-time upload)

1. Settings → Auth Tokens → Create Token
2. Scopes: `project:releases`, `org:read`

### Install SDK

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

This creates `sentry.client.config.ts`, `sentry.server.config.ts`, and updates `next.config.ts`.

### Env vars

```
SENTRY_DSN
SENTRY_AUTH_TOKEN    ← build-time only, not runtime
```

### Privacy rule

Never add `user.name` or `user.email` to Sentry context. The identity vault tokenization ensures only UUIDs reach Sentry automatically.

---

## 8. PostHog

> **FUTURE WORK — DO NOT CONFIGURE YET**
> `posthog-js` is not installed. There is no `PHProvider` component and no PostHog initialization in the app. Setting `NEXT_PUBLIC_POSTHOG_KEY` now will have no effect. Return to this section only after `posthog-js` is added and the provider is wired into the app layout.

**Why:** Product analytics. Must never receive real names — identify users by Supabase UUID only.

### Create account and project

1. [posthog.com](https://posthog.com) → sign up → New Project
2. Name: `carelog`
3. Copy Project API Key

### Install SDK

```bash
pnpm add posthog-js
```

Add a provider to `apps/web/components/providers/PHProvider.tsx`:

```tsx
"use client";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect } from "react";

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      person_profiles: "identified_only",
      capture_pageview: false,
    });
  }, []);
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
```

Identify users by UUID only:

```ts
posthog.identify(user.id); // UUID only — no name, no email
```

### Env vars

```
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

---

## Final Launch Checklist

- [ ] Supabase HIPAA BAA signed
- [ ] All 16 tables migrated to Supabase cloud
- [ ] Vercel deploy green, all env vars set
- [ ] Custom domain resolving + SSL active
- [ ] Resend domain verified, test email delivered
- [ ] Inngest synced, all functions visible, weekly digest test run passes
- [ ] Upstash rate limiter active (6th OTP → 429)
- [ ] Auth flow: OTP → dashboard working end-to-end
- [ ] Invite flow: invite sent → accepted → member appears in team

---

## Already shipped in code

As of 2026-04-14 these three services are fully wired (verify by grepping the codebase before re-doing setup work):

- ✅ Stripe webhook route at `apps/web/app/api/stripe/webhook/route.ts`, checkout / portal / verify routes shipped, `apps/web/lib/stripe.ts` client, `apps/web/app/(app)/subscriptions/page.tsx` UI
- ✅ Sentry: `sendDefaultPii: false` across `sentry.{client,server,edge}.config.ts`, env-var DSN
- ✅ PostHog: `apps/web/lib/posthog-server.ts`, client tracking via `instrumentation-client.ts`, UUID-only identify

What remains is **account-side** configuration (live-mode keys in Vercel, webhook endpoint registered with Stripe dashboard, PostHog privacy toggles). Covered in the per-service sections above.

---

## Mobile-specific setup

The mobile app (`apps/mobile/`) needs three additional pieces of third-party configuration. These are **optional for web-only launch** but required before shipping iOS/Android builds.

### Firebase / FCM (Android push only)

iOS uses APNs; Android needs FCM.

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name `carelog`, disable Analytics
2. Add an **Android** app: package name `com.carelog.app` (must match `apps/mobile/app.json` → `android.package`)
3. Download `google-services.json` → save to `apps/mobile/google-services.json`
4. Firebase → **Project settings** → **Cloud Messaging** → enable legacy API → copy **Server key**
5. `eas secret:create --scope project --name FCM_SERVER_KEY --value "<server-key>"`
6. Verify `eas.json` sets `"googleServicesFile": "./google-services.json"` under `build.production.android`

### Deep-link verification files (required for PP-008)

Must be served from the marketing domain (`https://care-log.org` or your chosen domain) at `/.well-known/`.

**iOS AASA** → `apps/web/public/.well-known/apple-app-site-association` (no `.json` extension):

```json
{
  "applinks": {
    "apps": [],
    "details": [{ "appID": "TEAMID.com.carelog.app", "paths": ["/invite/*"] }]
  }
}
```

Get **Team ID** from [developer.apple.com](https://developer.apple.com) → Account → Membership.

**Android asset links** → `apps/web/public/.well-known/assetlinks.json`:

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

Get fingerprint after first EAS Android build: `eas credentials --platform android`.

Verify post-deploy:

```bash
curl https://care-log.org/.well-known/apple-app-site-association
curl https://care-log.org/.well-known/assetlinks.json
```

### APNs (iOS push)

1. [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles** → App ID `com.carelog.app` with **Push Notifications** enabled
2. EAS dashboard → project → **Credentials** → **iOS** → **Add** → **Apple Push Notification Key (.p8)**
3. Alternative: `eas credentials` in terminal

---

## Final launch dependencies

Items that **block** Claude-executable stories in `BACKLOG.md`:

| Dependency | Blocks |
|---|---|
| Supabase cloud keys | `A2` — `supabase link` + `db push` + bucket create + `supabase test db` against cloud |
| Resend verified domain | `C3` — update weekly digest FROM address to `notifications@<verified-domain>` |
| `assetlinks.json` served + EAS build SHA-256 | `PP-008` — Android app-links verification |
| `google-services.json` in EAS | `PP-007` — Android push notification verification (after `PP-006` prebuild) |
| APNs `.p8` key in EAS | iOS production push builds |
