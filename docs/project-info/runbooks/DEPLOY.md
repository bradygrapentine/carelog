# Carelog — Deployment Guide

Follow these steps in order. Each section depends on the one before it.

---

## Prerequisites

- Vercel account (free tier works for deploy)
- Supabase account (Pro plan required for HIPAA BAA)
- Inngest account (free tier works to start)
- Resend account (free tier: 3,000 emails/mo)
- Upstash account (free tier: 10,000 requests/day)
- Stripe account (activate live mode before going live)
- Sentry account (free tier works)
- PostHog account (free tier: 1M events/mo)

---

## Step 1 — Supabase Cloud

### 1a. Create a project

1. Go to [supabase.com](https://supabase.com) → New project
2. Choose a region closest to your users (US East or US West)
3. Set a strong database password — save it, you'll need it for migrations
4. Wait for the project to provision (~2 min)

### 1b. Apply migrations

```bash
# In the repo root
supabase login
supabase link --project-ref <your-project-ref>

# Apply all migrations to the cloud project
supabase db push
```

Verify in the Supabase dashboard: Table Editor should show all 16 tables.

### 1c. Configure auth

1. Open your Supabase project dashboard
2. In the left sidebar, click **Authentication**
3. Click **URL Configuration** (top of the Authentication section)
4. Set **Site URL** to `https://care-log.org`
5. Under **Redirect URLs**, click **Add URL** and enter `https://care-log.org/auth/callback`
6. Click **Save**
7. Still in Authentication, click **Email** in the left sidebar
8. Set **OTP expiry** to `600` seconds
9. Ensure **Confirm email** is **enabled** (OTP is the confirmation mechanism — do not disable it)
10. Click **Save**

### 1d. Get your keys

From Supabase dashboard → Project Settings → API:

- `NEXT_PUBLIC_SUPABASE_URL` — your project URL (e.g. `https://xyzabc.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (never expose this)

---

## Step 2 — Vercel Deployment

### 2a. Connect the repo

1. Go to [vercel.com](https://vercel.com) → New Project → Import Git Repository
2. Select the `carelog` repo
3. Set **Root Directory** to `apps/web`
4. Framework: Next.js (auto-detected)

### 2b. Use the Supabase Vercel integration

1. In Vercel: Integrations → Browse → Supabase → Add
2. Connect to your Supabase project
3. This auto-sets `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in Vercel

**Note:** Verify the integration set `SUPABASE_SERVICE_ROLE_KEY` (not `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`). The service role key must never be public.

### 2c. Set remaining environment variables

In Vercel → Project → Settings → Environment Variables, add:

```
# App URL (used in server-side redirects and email links)
NEXT_PUBLIC_APP_URL=https://care-log.org

# Inngest (Step 3)
INNGEST_EVENT_KEY=<from Inngest dashboard>
INNGEST_SIGNING_KEY=<from Inngest dashboard>

# Resend (Step 4)
RESEND_API_KEY=<from Resend dashboard>
RESEND_FROM_EMAIL=digest@care-log.org

# Upstash Redis (Step 5)
UPSTASH_REDIS_REST_URL=<from Upstash dashboard>
UPSTASH_REDIS_REST_TOKEN=<from Upstash dashboard>

# Stripe (Step 6)
STRIPE_SECRET_KEY=<live secret key from Stripe>
STRIPE_WEBHOOK_SECRET=<from Stripe webhook setup>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<live publishable key>
STRIPE_PRICE_MONTHLY=<monthly Price ID from Step 6a>
STRIPE_PRICE_ANNUAL=<annual Price ID from Step 6a>

# Sentry (Step 7)
SENTRY_DSN=<from Sentry project>
SENTRY_AUTH_TOKEN=<for source map upload>

# PostHog (Step 8)
NEXT_PUBLIC_POSTHOG_KEY=<from PostHog project>
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# OCR (optional — prescription scan feature, Phase 3)
# OCR_API_KEY=<if wiring ocrPrescription Inngest function>
```

### 2d. Deploy

Click **Deploy**. First deploy takes ~2 min.

After deploy, verify auth: sign in at your production URL and confirm session persists on page reload. All protected pages use server-side `createServerSupabase().auth.getUser()`.

---

## Step 3 — Inngest

### 3a. Create an account and app

1. Go to [app.inngest.com](https://app.inngest.com) and sign up or log in
2. Click **Create App** → name it `carelog` → click **Create**

### 3b. Get your keys

1. In the left sidebar, click **Manage** → **Event Keys**
2. Click **Create Event Key** → name it `carelog-production` → copy the key
3. Set `INNGEST_EVENT_KEY` in Vercel with this value
4. In the left sidebar, click **Manage** → **Signing Keys**
5. Copy the **Active Signing Key** (starts with `signkey-prod-...`)
6. Set `INNGEST_SIGNING_KEY` in Vercel with this value

### 3c. Sync the serve endpoint

This step registers your functions with Inngest. Do this after the first Vercel deploy completes.

1. In the Inngest dashboard, click **Apps** in the left sidebar
2. Click **Sync New App**
3. Enter `https://care-log.org/api/inngest` as the URL
4. Click **Sync** — Inngest will discover all functions automatically
5. Confirm `weekly-digest` appears under **Functions**

### 3d. Verify the weekly digest cron

1. Click **Functions** → select `weekly-digest`
2. Confirm the schedule shows `TZ=UTC 0 8 * * 1` (Mondays 8am UTC)
3. Click **Invoke** → **Run** to trigger a test run
4. Check the run logs — a successful run shows each step completing without error

---

## Step 4 — Resend

### 4a. Create an API key

1. Go to [resend.com](https://resend.com) → API Keys → Create API Key
2. Name: `carelog-production`
3. Permissions: Sending access
4. Copy the key → set `RESEND_API_KEY` in Vercel

### 4b. Verify your domain

1. Resend → Domains → Add Domain → enter `care-log.org`
2. Add the DNS records Resend provides (SPF, DKIM, DMARC)
3. Verify propagation (~15 min)
4. Set `RESEND_FROM_EMAIL=digest@care-log.org` (or `hello@care-log.org`)

### 4c. Test OTP email

Sign in at your production URL. OTP should arrive in < 10 seconds.

**Note:** `onboarding@resend.dev` cannot be used as a from address for third-party apps — Resend returns 403. A verified domain (Step 4b) is required before invite emails and the weekly digest will send. OTP emails are sent by Supabase directly and are not affected.

---

## Step 5 — Upstash Redis

### 5a. Create a database

1. Go to [console.upstash.com](https://console.upstash.com) and sign up or log in
2. Click **Create Database**
3. Select **Redis** as the type
4. Name: `carelog-prod`
5. Select **Regional** (not Global — unnecessary at this scale)
6. Choose the region closest to your Vercel deployment (check Vercel → Project → Settings → General → Regions to confirm)
7. Leave TLS enabled (default)
8. Click **Create**

### 5b. Get credentials

1. Click into the `carelog-prod` database
2. Scroll down to the **REST API** section
3. Copy the value under **UPSTASH_REDIS_REST_URL** — starts with `https://`
4. Copy the value under **UPSTASH_REDIS_REST_TOKEN** — a long base64 string
5. Add both to Vercel → Project → Settings → Environment Variables

The rate limiter in `apps/web/lib/rateLimit.ts` activates automatically when both vars are present. It no-ops silently in local dev when they are absent.

---

## Step 6 — Stripe

### 6a. Create products

In Stripe dashboard (live mode):

1. Products → Add Product → **Carelog Family Plan**
2. Add two prices:
   - Monthly: $14.00/month — copy the Price ID (`price_...`)
   - Yearly: $120.00/year — copy the Price ID
3. Save both Price IDs — you'll need them when wiring the billing UI

### 6b. Set up webhook

1. Stripe → Developers → Webhooks → Add Endpoint
2. URL: `https://care-log.org/api/stripe/webhook`
3. Events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the **Signing Secret** → set `STRIPE_WEBHOOK_SECRET` in Vercel

**Note:** The Stripe billing UI and webhook handler are not yet built. The keys are in place for when billing is wired (pre-launch requirement). The `organizations.stripe_id` and `organizations.plan` columns already exist in the schema.

---

## Step 7 — Sentry

### 7a. Create a project

1. Go to [sentry.io](https://sentry.io) → New Project → Next.js
2. Name: `carelog-web`
3. Copy the **DSN** → set `SENTRY_DSN` in Vercel

### 7b. Source maps

1. Sentry → Settings → Auth Tokens → Create Token
2. Scopes: `project:releases`, `org:read`
3. Set `SENTRY_AUTH_TOKEN` in Vercel (used during Vercel build to upload source maps)

### 7c. Wire Sentry into the app — DONE

`@sentry/nextjs` is installed. Configs exist:
- `instrumentation-client.ts` — client-side init with `sendDefaultPii: false`, Replay disabled
- `sentry.server.config.ts` — server init with `sendDefaultPii: false`
- `sentry.edge.config.ts` — edge init with `sendDefaultPii: false`

**Remaining:** Set `SENTRY_AUTH_TOKEN` in Vercel for source map uploads.

**Privacy note:** Sentry must never capture PHI. `sendDefaultPii: false` in all configs. Do not add `user.name` or `user.email` to Sentry context.

---

## Step 8 — PostHog

### 8a. Create a project

1. Go to [posthog.com](https://posthog.com) → New Project
2. Name: `carelog`
3. Copy the **Project API Key** → set `NEXT_PUBLIC_POSTHOG_KEY` in Vercel

### 8b. Install the SDK — DONE

`posthog-js` and `posthog-node` are installed. Setup:
- `instrumentation-client.ts` — `posthog.init()` with `/ingest` proxy, `person_profiles: 'identified_only'`
- `components/providers/PostHogProvider.tsx` — React context wrapper in `layout.tsx`
- `lib/posthog-server.ts` — server-side client singleton for API route events
- `next.config.ts` — `/ingest` proxy rewrites to `us.i.posthog.com` (ad-blocker resilience)
- Events instrumented: sign-in, onboarding, invite, journal entry, burnout, export, subscription cancel

**Remaining:** Set `NEXT_PUBLIC_POSTHOG_KEY` in Vercel.

**Privacy note:** `posthog.identify(user.id)` — UUID only, never email or name.

---

## Step 9 — Custom Domain

1. Vercel → Project → Settings → Domains → Add Domain
2. Add `care-log.org` and `www.care-log.org`
3. Update DNS at your registrar with the CNAME/A records Vercel provides
4. SSL is automatic via Vercel

Update Supabase → Authentication → Settings → Site URL to `https://care-log.org`.

---

## Step 10 — Post-Deploy Verification

Work through this checklist after all services are connected:

### Auth
- [ ] Sign in with OTP — email arrives via Resend (not Mailpit)
- [ ] Session persists on page reload
- [ ] Sign out works
- [ ] Sign in redirects to `/dashboard`

### Journal
- [ ] Create a journal entry
- [ ] Mood tag selects correctly
- [ ] Entry appears in timeline
- [ ] Flag for doctor works (coordinator role)
- [ ] Supporter reactions work

### Team
- [ ] Invite a new user via email
- [ ] Invite email arrives with correct link
- [ ] New user can accept invite
- [ ] Team panel shows real names

### Background jobs
- [ ] Inngest dashboard shows functions registered
- [ ] Manually trigger weekly digest — email arrives

### Rate limiting
- [ ] Make 6 rapid OTP requests — 6th is rate-limited (429 response)

### Error tracking
- [ ] Trigger a test error — appears in Sentry dashboard

---

## Pre-Launch Checklist (remaining before real users)

These items (tracked in `BACKLOG.md` §1–§5) must be complete:

- [ ] Stripe billing wired — org must have active subscription to use the app
- [x] Server-side auth migration — `(app)/layout.tsx` + all protected pages use `createServerSupabase()`
- [x] Mobile offline queue wired to tRPC — `careEvents.insert` with idempotencyKey
- [x] Error boundaries on all client pages
- [x] Privacy policy and terms of service pages — `(marketing)/privacy` and `(marketing)/terms`
- [ ] Supabase HIPAA BAA signed (Pro plan required)

---

## Environment Variable Reference

| Variable | Where | Required |
|----------|-------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Yes |
| `NEXT_PUBLIC_APP_URL` | App | Yes |
| `INNGEST_EVENT_KEY` | Inngest | Yes |
| `INNGEST_SIGNING_KEY` | Inngest | Yes |
| `RESEND_API_KEY` | Resend | Yes |
| `RESEND_FROM_EMAIL` | Resend | Yes |
| `UPSTASH_REDIS_REST_URL` | Upstash | Yes |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash | Yes |
| `STRIPE_SECRET_KEY` | Stripe | Yes (pre-launch) |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Yes (pre-launch) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | Yes (pre-launch) |
| `STRIPE_PRICE_MONTHLY` | Stripe | Yes (pre-launch) |
| `STRIPE_PRICE_ANNUAL` | Stripe | Yes (pre-launch) |
| `SENTRY_DSN` | Sentry | Yes |
| `SENTRY_AUTH_TOKEN` | Sentry | Build only |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog | Yes |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog | Yes |
| `OCR_API_KEY` | OCR service | No (Phase 3) |
