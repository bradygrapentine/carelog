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

In Supabase dashboard → Authentication → Settings:

- **Site URL:** `https://yourdomain.com`
- **Redirect URLs:** add `https://yourdomain.com/auth/callback`
- **Email OTP expiry:** 600 seconds (10 min)
- **Disable email confirmations:** OFF (OTP is the confirmation)

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
# Inngest (Step 3)
INNGEST_EVENT_KEY=<from Inngest dashboard>
INNGEST_SIGNING_KEY=<from Inngest dashboard>

# Resend (Step 4)
RESEND_API_KEY=<from Resend dashboard>
RESEND_FROM_EMAIL=digest@yourdomain.com

# Upstash Redis (Step 5)
UPSTASH_REDIS_REST_URL=<from Upstash dashboard>
UPSTASH_REDIS_REST_TOKEN=<from Upstash dashboard>

# Stripe (Step 6)
STRIPE_SECRET_KEY=<live secret key from Stripe>
STRIPE_WEBHOOK_SECRET=<from Stripe webhook setup>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<live publishable key>

# Sentry (Step 7)
SENTRY_DSN=<from Sentry project>
SENTRY_AUTH_TOKEN=<for source map upload>

# PostHog (Step 8)
NEXT_PUBLIC_POSTHOG_KEY=<from PostHog project>
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### 2d. Deploy

Click **Deploy**. First deploy takes ~2 min.

After deploy, verify the auth fix: server-side `createServerSupabase().auth.getUser()` works correctly on Supabase cloud. The client-side auth workaround in `TECH_DEBT.md` #1 auto-resolves here — you can migrate pages to server-side auth after verifying.

---

## Step 3 — Inngest

### 3a. Create an app

1. Go to [inngest.com](https://inngest.com) → New App
2. Name it `carelog`
3. Copy the **Event Key** and **Signing Key**

### 3b. Register the serve endpoint

Inngest discovers your functions at `/api/inngest`. After Vercel deploys:

1. In Inngest dashboard → Apps → Sync App
2. URL: `https://yourdomain.com/api/inngest`
3. Inngest will discover and register all functions (weekly digest, gap detector when built, etc.)

### 3c. Verify the weekly digest cron

In Inngest dashboard → Functions → `weekly-digest`, confirm the cron schedule is `0 8 * * 1` (Mondays 8am UTC). Trigger a test run to verify the email sends.

---

## Step 4 — Resend

### 4a. Create an API key

1. Go to [resend.com](https://resend.com) → API Keys → Create API Key
2. Name: `carelog-production`
3. Permissions: Sending access
4. Copy the key → set `RESEND_API_KEY` in Vercel

### 4b. Verify your domain

1. Resend → Domains → Add Domain → enter `yourdomain.com`
2. Add the DNS records Resend provides (SPF, DKIM, DMARC)
3. Verify propagation (~15 min)
4. Set `RESEND_FROM_EMAIL=digest@yourdomain.com` (or `hello@yourdomain.com`)

### 4c. Test OTP email

Sign in at your production URL. OTP should arrive in < 10 seconds.

---

## Step 5 — Upstash Redis

### 5a. Create a database

1. Go to [upstash.com](https://upstash.com) → Create Database
2. Name: `carelog-prod`
3. Region: same as Vercel deployment region
4. Type: Regional (not Global — not needed at this scale)

### 5b. Get credentials

From Upstash dashboard → REST API tab:

- `UPSTASH_REDIS_REST_URL` — the REST URL
- `UPSTASH_REDIS_REST_TOKEN` — the REST token

Add both to Vercel. The rate limiter in `apps/web/lib/rateLimit.ts` activates automatically when these are present.

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
2. URL: `https://yourdomain.com/api/stripe/webhook`
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

### 7c. Wire Sentry into the app

Add to `apps/web/`:

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

This creates `sentry.client.config.ts`, `sentry.server.config.ts`, and updates `next.config.ts`.

**Privacy note:** Sentry must never capture PHI. The identity vault tokenization ensures this — Sentry only sees UUIDs, never real names. Do not add `user.name` or `user.email` to Sentry context.

---

## Step 8 — PostHog

### 8a. Create a project

1. Go to [posthog.com](https://posthog.com) → New Project
2. Name: `carelog`
3. Copy the **Project API Key** → set `NEXT_PUBLIC_POSTHOG_KEY` in Vercel

### 8b. Install the SDK

```bash
pnpm add posthog-js
```

Add a PostHog provider to `apps/web/components/providers/` (or wrap in `layout.tsx`):

```tsx
'use client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      person_profiles: 'identified_only',
      capture_pageview: false, // manual for App Router
    })
  }, [])
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
```

**Privacy note:** PostHog must never receive real names. Identify users by their Supabase UUID only:

```ts
posthog.identify(user.id) // UUID only — no name, no email
```

---

## Step 9 — Custom Domain

1. Vercel → Project → Settings → Domains → Add Domain
2. Add `yourdomain.com` and `www.yourdomain.com`
3. Update DNS at your registrar with the CNAME/A records Vercel provides
4. SSL is automatic via Vercel

Update Supabase → Authentication → Settings → Site URL to `https://yourdomain.com`.

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

These items from `TECH_DEBT.md` and `BUILD_STATUS.md` must be complete:

- [ ] Stripe billing wired — org must have active subscription to use the app
- [ ] Server-side auth migration — replace `useEffect` auth pattern with server components now that Supabase cloud is live
- [ ] Mobile offline queue wired to tRPC (`apps/mobile/hooks/useOfflineWrite.ts` TODO)
- [ ] Error boundaries on all client pages
- [ ] Supabase HIPAA BAA signed (Pro plan required)
- [ ] Privacy policy and terms of service pages

---

## Environment Variable Reference

| Variable | Where | Required |
|----------|-------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Yes |
| `INNGEST_EVENT_KEY` | Inngest | Yes |
| `INNGEST_SIGNING_KEY` | Inngest | Yes |
| `RESEND_API_KEY` | Resend | Yes |
| `RESEND_FROM_EMAIL` | Resend | Yes |
| `UPSTASH_REDIS_REST_URL` | Upstash | Yes |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash | Yes |
| `STRIPE_SECRET_KEY` | Stripe | Yes (pre-launch) |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Yes (pre-launch) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | Yes (pre-launch) |
| `SENTRY_DSN` | Sentry | Yes |
| `SENTRY_AUTH_TOKEN` | Sentry | Build only |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog | Yes |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog | Yes |
