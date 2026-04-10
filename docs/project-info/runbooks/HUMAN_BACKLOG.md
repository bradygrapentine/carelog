# Human Backlog — Before-Launch Setup

These are tasks that require human action: clicking through web UIs, creating accounts, and setting environment variables. Each section tells you exactly what to do and what values to copy into your `.env.local` and Vercel dashboard.

**Order matters:** Complete Sub-Wave A (Supabase → Vercel) before other services, since Vercel env vars need the Supabase URLs.

---

## Sub-Wave A: Deployment Infrastructure

### 1. Supabase Cloud

**Goal:** Create a cloud project that mirrors your local database.

1. Go to [supabase.com](https://supabase.com) → Sign in
2. Click **New Project**
3. Choose your organization (or create one)
4. Fill in:
   - **Name:** `carelog`
   - **Database Password:** Generate a strong password — **save it in 1Password now**
   - **Region:** Choose the region closest to your target users (US East or US West)
5. Click **Create new project** — takes ~2 minutes to provision

**Get your keys:**
1. In the project dashboard → **Project Settings** (gear icon) → **API**
2. Copy:
   - **Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key (click to reveal) → this is `SUPABASE_SERVICE_ROLE_KEY`

3. In **Project Settings** → **Database** → scroll to **Connection string**
4. Select **URI** tab → copy the `postgresql://...` string → this is `SUPABASE_DB_URL`
   - Replace `[YOUR-PASSWORD]` in the string with the password you set in step 4 above

**Add to `apps/web/.env.local`:**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_DB_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres
```

**Get your project ref** (needed for `supabase link`):
- In the dashboard URL: `https://supabase.com/dashboard/project/<PROJECT_REF>`
- Copy `<PROJECT_REF>` — it's a string like `abcdefghijklmnop`

After saving keys, hand off to Claude to run `supabase link` and push migrations (Task A2 in the plan).

---

### 2. Vercel

**Goal:** Deploy the Next.js app with all environment variables wired.

**Pre-requisite:** GitHub repository must be accessible (it already is at `bradygrapentine/carelog` or similar).

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click **Add New Project**
3. Import your `carelog` repository
4. Configure:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `apps/web`
   - **Build Command:** `cd ../.. && pnpm build --filter=web` (Turborepo)
   - **Output Directory:** `.next`
   - **Install Command:** `pnpm install --frozen-lockfile`
5. **Before clicking Deploy** — add all environment variables (see below)

**Environment Variables to add in Vercel:**

Click **Environment Variables** tab and add each of these. Set them for **Production**, **Preview**, and **Development** unless noted.

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | From Supabase | From step 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase | From step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase | From step 1; Production only |
| `SUPABASE_DB_URL` | From Supabase | Production only |
| `NEXT_PUBLIC_SENTRY_DSN` | `https://b7f31415e84a995296f5f019cc3fff26@o4511181211369472.ingest.us.sentry.io/4511192928157696` | Already configured |
| `SENTRY_ORG` | `brady-grapentines-organization` | Already configured |
| `SENTRY_PROJECT` | `carelog-web` | Already configured |
| `NEXT_PUBLIC_POSTHOG_KEY` | From PostHog | Add after step 3 below |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` | Add after step 3 below |
| `INNGEST_SIGNING_KEY` | From Inngest | Add after step 5 below |
| `INNGEST_EVENT_KEY` | From Inngest | Add after step 5 below |
| `RESEND_API_KEY` | From Resend | Add after step 6 below |
| `STRIPE_SECRET_KEY` | From Stripe | Production only; Add after step 7 |
| `STRIPE_WEBHOOK_SECRET` | From Stripe | Production only; Add after step 7 |
| `STRIPE_PRICE_ID_MONTHLY` | From Stripe | Add after step 7 |
| `STRIPE_PRICE_ID_ANNUAL` | From Stripe | Add after step 7 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | From Stripe | Add after step 7 |

6. Click **Deploy**
7. Once deployed, note your URL: `carelog-xxx.vercel.app`

---

### 3. Custom Domain (Optional — can use carelog.vercel.app for initial launch)

1. In Vercel project → **Settings** → **Domains**
2. Add your domain (e.g. `app.yourcarelog.com`)
3. Vercel shows you DNS records to add:
   - If using Vercel DNS (recommended): click **Transfer to Vercel**
   - If using your own registrar: add the `A` and `CNAME` records Vercel shows you
4. Wait for SSL certificate to provision (usually < 5 minutes)

---

## Sub-Wave B: Observability

### 4. Sentry (Account already exists — just verify)

Your Sentry account and project are already configured (`brady-grapentines-organization / carelog-web`). The DSN is hardcoded in the config files.

**Just verify:**
1. Go to [sentry.io](https://sentry.io) → Sign in
2. Find project **carelog-web**
3. Go to **Settings** → **Client Keys (DSN)** → confirm the DSN matches:
   `https://b7f31415e84a995296f5f019cc3fff26@o4511181211369472.ingest.us.sentry.io/4511192928157696`
4. Nothing else to do — Claude will fix the PHI config (Task B1)

---

### 5. PostHog

**Goal:** Set up analytics without PHI leakage.

1. Go to [posthog.com](https://posthog.com) → **Get started free**
2. Sign up with your email
3. Create a new organization: `Carelog`
4. Create a project: `carelog-web`
5. Select **US** region (or EU if you expect European users)
6. On the onboarding screen, select **Next.js** as your framework
7. Copy the snippet shown — you only need the **API key** (`phc_...`), not the full snippet

**Copy these values:**
- **Project API Key:** shown as `phc_xxxxxxxx...` → this is `NEXT_PUBLIC_POSTHOG_KEY`
- **API Host:** shown in the snippet as `https://us.i.posthog.com` → this is `NEXT_PUBLIC_POSTHOG_HOST`

**Add to `apps/web/.env.local`:**
```
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

**Add to Vercel** (Settings → Environment Variables):
```
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

**PostHog privacy settings (important):**
1. In PostHog → **Settings** → **Privacy**
2. Turn OFF: **Capture IP address**
3. Turn OFF: **Person profiles** (we set `person_profiles: 'never'` in code, but belt-and-suspenders)

---

## Sub-Wave C: Transactional Services

### 6. Inngest Cloud

**Goal:** Connect your background job functions to the Inngest cloud.

1. Go to [inngest.com](https://inngest.com) → **Get started**
2. Sign up → Create an organization: `Carelog`
3. In the dashboard → **Settings** → **API Keys**
4. Copy:
   - **Event Key** → this is `INNGEST_EVENT_KEY`
   - **Signing Key** → this is `INNGEST_SIGNING_KEY`

**Add to `apps/web/.env.local`:**
```
INNGEST_EVENT_KEY=event-key-...
INNGEST_SIGNING_KEY=signkey-prod-...
```

**Add to Vercel** (Settings → Environment Variables — Production only):
```
INNGEST_EVENT_KEY=event-key-...
INNGEST_SIGNING_KEY=signkey-prod-...
```

**Register your app (after deploying to Vercel):**
1. In Inngest dashboard → **Apps** → **Add App**
2. Enter your Vercel deployment URL: `https://your-app.vercel.app/api/inngest`
3. Click **Sync** — Inngest will discover your functions (weeklyDigest, gapDetector, refillAlert, burnoutAlert, ocrPrescription)
4. Verify all 5 functions appear in the **Functions** tab

---

### 7. Resend

**Goal:** Set up transactional email with your own domain.

1. Go to [resend.com](https://resend.com) → **Get started**
2. Sign up → Create an account
3. In the dashboard → **API Keys** → **Create API Key**
   - Name: `carelog-production`
   - Permission: **Full access**
4. Copy the API key (shown only once) → this is `RESEND_API_KEY`

**Add to `apps/web/.env.local`:**
```
RESEND_API_KEY=re_your_key_here
```

**Add to Vercel** (Settings → Environment Variables — Production only):
```
RESEND_API_KEY=re_your_key_here
```

**Verify your sending domain:**
1. In Resend dashboard → **Domains** → **Add Domain**
2. Enter your domain (e.g. `yourcarelog.com`)
3. Resend shows you DNS records to add (DKIM, SPF, DMARC)
4. Add these records at your DNS provider (Vercel DNS, Cloudflare, etc.)
5. Click **Verify** — takes up to 48 hours but usually minutes

**Update FROM address in code (tell Claude):**
Once domain is verified, ask Claude to update the weekly digest `from:` address from the Resend test domain to `notifications@yourcarelog.com` (or similar).

---

## Sub-Wave D: Billing

### 8. Stripe

**Goal:** Create a Stripe account, product, and prices for $14/mo and $120/yr family plans.

**Step 1: Create account**
1. Go to [stripe.com](https://stripe.com) → **Start now**
2. Sign up with your business email
3. Complete business verification when prompted (can be done later for test mode)

**Step 2: Create product + prices**
1. In Stripe dashboard → **Products** → **Add product**
2. Fill in:
   - **Name:** `Carelog Family Plan`
   - **Description:** `Full access for your entire care team — unlimited members`
3. Under **Pricing** → **Add price**:
   - Monthly: **$14.00 USD** · **Recurring** · **Monthly**
   - Click **Add another price** → Annual: **$120.00 USD** · **Recurring** · **Yearly**
4. Click **Save product**
5. On the product page, copy the **Price IDs** (format: `price_xxxxxxx`):
   - Monthly price ID → `STRIPE_PRICE_ID_MONTHLY`
   - Annual price ID → `STRIPE_PRICE_ID_ANNUAL`

**Step 3: Get API keys**
1. In Stripe dashboard → **Developers** → **API keys**
2. Copy:
   - **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** (click Reveal) → `STRIPE_SECRET_KEY`

**Step 4: Set up webhook**
1. In Stripe dashboard → **Developers** → **Webhooks** → **Add endpoint**
2. **Endpoint URL:** `https://your-app.vercel.app/api/stripe/webhook`
3. **Events to send:** Select these four:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Click **Add endpoint**
5. On the webhook detail page → click **Reveal** next to **Signing secret**
6. Copy the `whsec_...` value → `STRIPE_WEBHOOK_SECRET`

**Add to `apps/web/.env.local`:**
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_MONTHLY=price_...
STRIPE_PRICE_ID_ANNUAL=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Add to Vercel** (Settings → Environment Variables):
- `STRIPE_SECRET_KEY` — Production only
- `STRIPE_WEBHOOK_SECRET` — Production only
- `STRIPE_PRICE_ID_MONTHLY` — All environments
- `STRIPE_PRICE_ID_ANNUAL` — All environments
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — All environments

**For local webhook testing** (optional, for testing the webhook handler):
1. Install Stripe CLI: `brew install stripe/stripe-cli/stripe`
2. Run: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
3. Copy the local signing secret shown → use as `STRIPE_WEBHOOK_SECRET` in `.env.local` for local dev
4. In another terminal, trigger test events: `stripe trigger checkout.session.completed`

---

## Summary Checklist

| Service | Account | Keys copied | Vercel vars set | Notes |
|---------|---------|-------------|-----------------|-------|
| Supabase cloud | ☐ | ☐ | ☐ | Run `supabase link` after |
| Vercel | ☐ | n/a | ☐ | Deploy after all keys added |
| Sentry | ✅ | ✅ | ☐ | DSN already in code |
| PostHog | ☐ | ☐ | ☐ | |
| Inngest | ☐ | ☐ | ☐ | Register app after deploy |
| Resend | ☐ | ☐ | ☐ | Domain verify takes time |
| Stripe | ☐ | ☐ | ☐ | Use test mode initially |
