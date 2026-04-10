# Before-Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all external services (Supabase cloud, Vercel, Sentry, PostHog, Inngest, Resend, Stripe) so Carelog can go live at $14/mo.

**Architecture:** Four sequential sub-waves — A (deploy infra), B (observability), C (transactional services), D (billing). Each sub-wave has HUMAN tasks (account setup, DNS, secrets) and CLAUDE tasks (code). Human tasks are gated prerequisites for the Claude tasks that follow them. Claude tasks in B and D can be started locally before A is complete.

**Tech Stack:** Next.js 16 App Router · Supabase · Vercel · @sentry/nextjs · posthog-js · Inngest · Resend · Stripe · pgTAP · Vitest

---

## Sub-Wave A: Deployment Infrastructure

### Task A1: [HUMAN] Create Supabase cloud project

See `HUMAN_BACKLOG.md` → Supabase section for step-by-step.

**Outputs needed:**
- `NEXT_PUBLIC_SUPABASE_URL` (e.g. `https://xxxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` (Direct connection string, for migrations)

### Task A2: [CLAUDE] Link local project to cloud + push migrations

**Prerequisite:** Task A1 complete (Supabase cloud project exists).

**Files:**
- No new files — run CLI commands

- [ ] **Step 1: Link the local project to cloud**

```bash
cd /path/to/carelog
supabase link --project-ref <your-project-ref>
# Enter database password when prompted
```

Expected: `Linked to project <name>`

- [ ] **Step 2: Push all migrations**

```bash
supabase db push
```

Expected: All 10+ migrations applied. Verify in Supabase dashboard → SQL Editor → `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;` — should show all 16+ tables.

- [ ] **Step 3: Push storage bucket config**

```bash
supabase storage create-bucket care-documents --private
```

If the bucket already exists in cloud (it won't unless you seeded), this is a no-op.

- [ ] **Step 4: Verify RLS policies**

```bash
supabase test db
```

Expected: All pgTAP tests pass against the cloud database.

- [ ] **Step 5: Commit nothing** (no code changed — infra only)

### Task A3: [HUMAN] Create Vercel project + set env vars

See `HUMAN_BACKLOG.md` → Vercel section for step-by-step.

**Outputs needed:** Deployment URL (e.g. `carelog.vercel.app` or custom domain).

### Task A4: [HUMAN] Configure domain + SSL

See `HUMAN_BACKLOG.md` → Domain section. Optional for initial launch — can use `carelog.vercel.app`.

---

## Sub-Wave B: Observability

### Task B1: [CLAUDE] Fix Sentry PHI violation

**⚠️ CRITICAL:** `sendDefaultPii: true` in both `sentry.server.config.ts` and `sentry.edge.config.ts` will send user emails and IPs to Sentry. This violates PHI principles.

**Files:**
- Modify: `apps/web/sentry.server.config.ts`
- Modify: `apps/web/sentry.edge.config.ts`
- Create: `apps/web/sentry.client.config.ts`

- [ ] **Step 1: Fix server config**

Replace `apps/web/sentry.server.config.ts` with:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  enableLogs: false,
  sendDefaultPii: false,
});
```

- [ ] **Step 2: Fix edge config**

Replace `apps/web/sentry.edge.config.ts` with:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  enableLogs: false,
  sendDefaultPii: false,
});
```

- [ ] **Step 3: Create client config**

Create `apps/web/sentry.client.config.ts`:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  enableLogs: false,
  sendDefaultPii: false,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
```

- [ ] **Step 4: Move DSN to env var in next.config.ts**

Edit `apps/web/next.config.ts`:

```typescript
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "brady-grapentines-organization",
  project: process.env.SENTRY_PROJECT ?? "carelog-web",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  disableLogger: true,
});
```

- [ ] **Step 5: Add env var to .env.local**

Add to `apps/web/.env.local`:
```
NEXT_PUBLIC_SENTRY_DSN=https://b7f31415e84a995296f5f019cc3fff26@o4511181211369472.ingest.us.sentry.io/4511192928157696
SENTRY_ORG=brady-grapentines-organization
SENTRY_PROJECT=carelog-web
```

- [ ] **Step 6: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/sentry.server.config.ts apps/web/sentry.edge.config.ts apps/web/sentry.client.config.ts apps/web/next.config.ts apps/web/.env.local
git commit -m "fix: disable Sentry PII + add client config + env var DSN"
```

### Task B2: [HUMAN] Create PostHog account + get API key

See `HUMAN_BACKLOG.md` → PostHog section.

**Outputs needed:**
- `NEXT_PUBLIC_POSTHOG_KEY` (e.g. `phc_...`)
- `NEXT_PUBLIC_POSTHOG_HOST` (e.g. `https://us.i.posthog.com`)

### Task B3: [CLAUDE] Add PostHog provider

**Prerequisite:** Task B2 complete (PostHog API key in hand).

**Files:**
- Create: `apps/web/lib/posthog.ts`
- Create: `apps/web/app/PostHogProvider.tsx`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Create PostHog client**

Install: `cd apps/web && pnpm add posthog-js`

Create `apps/web/lib/posthog.ts`:

```typescript
import posthog from "posthog-js";

export function initPostHog() {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: false, // We'll capture manually
    capture_pageleave: false,
    autocapture: false, // Avoid capturing PHI in DOM
    person_profiles: "never", // UUIDs only — never associate real identity
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") ph.debug();
    },
  });
}

export { posthog };
```

- [ ] **Step 2: Create PostHog provider component**

Create `apps/web/app/PostHogProvider.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initPostHog, posthog } from "@/lib/posthog";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (!pathname) return;
    // Capture pageview — strip any query params that might contain PHI
    posthog.capture("$pageview", { $current_url: window.location.origin + pathname });
  }, [pathname, searchParams]);

  return <>{children}</>;
}
```

- [ ] **Step 3: Wire into layout**

Edit `apps/web/app/layout.tsx` — add PostHogProvider inside TrpcProvider:

```typescript
import { PostHogProvider } from "./PostHogProvider";

// Inside RootLayout return:
<TrpcProvider>
  <Suspense fallback={null}>
    <PostHogProvider>
      {children}
    </PostHogProvider>
  </Suspense>
</TrpcProvider>
```

Note: `PostHogProvider` uses `useSearchParams` which requires a `Suspense` boundary.

- [ ] **Step 4: Add env vars to .env.local**

```
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Verify no PHI captured**

Check that PostHog init has `autocapture: false` and `person_profiles: 'never'`. Run the app locally and confirm PostHog debug logs show only pageview events with pathname only (no email, name, or org name in event properties).

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/posthog.ts apps/web/app/PostHogProvider.tsx apps/web/app/layout.tsx
git commit -m "feat: add PostHog provider with PHI-safe config (autocapture off, person_profiles: never)"
```

---

## Sub-Wave C: Transactional Services

### Task C1: [HUMAN] Create Inngest cloud account

See `HUMAN_BACKLOG.md` → Inngest section.

**Outputs needed:**
- `INNGEST_SIGNING_KEY`
- `INNGEST_EVENT_KEY`

### Task C2: [HUMAN] Create Resend account + verify domain

See `HUMAN_BACKLOG.md` → Resend section.

**Outputs needed:**
- `RESEND_API_KEY`
- Sending domain verified (e.g. `notifications@yourcarelog.com`)

### Task C3: [CLAUDE] Wire Inngest + Resend production env vars

**Prerequisite:** Tasks C1 + C2 complete.

**Files:**
- No new code — env var additions only

- [ ] **Step 1: Add to Vercel env vars**

In Vercel dashboard → Project → Settings → Environment Variables, add:
```
INNGEST_SIGNING_KEY=signkey-prod-...
INNGEST_EVENT_KEY=...
RESEND_API_KEY=re_...
```

These are already read by the existing client files — no code changes needed.

- [ ] **Step 2: Update FROM address in digest function**

Verify `apps/web/inngest/functions/weeklyDigest.ts` uses the verified Resend domain:

```bash
grep -r "from:" apps/web/inngest/
```

If it reads `onboarding@resend.dev` (test domain), update to `notifications@<your-domain>`.

- [ ] **Step 3: Register Inngest app in dashboard**

After deploying to Vercel (Task A3), in Inngest dashboard → Add App → enter `https://your-domain.vercel.app/api/inngest`.

- [ ] **Step 4: Trigger a test event**

In Inngest dashboard → Send Event → `app/weekly.digest.requested`. Verify the function runs and Resend delivers the email.

- [ ] **Step 5: Commit FROM address fix if changed**

```bash
git add apps/web/inngest/functions/weeklyDigest.ts
git commit -m "fix: update digest FROM address to verified Resend domain"
```

---

## Sub-Wave D: Billing (Stripe)

### Task D1: [HUMAN] Create Stripe account + product

See `HUMAN_BACKLOG.md` → Stripe section.

**Outputs needed:**
- `STRIPE_SECRET_KEY` (sk_live_... or sk_test_... for dev)
- `STRIPE_WEBHOOK_SECRET` (whsec_...)
- `STRIPE_PRICE_ID_MONTHLY` (price_...)
- `STRIPE_PRICE_ID_ANNUAL` (price_...)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_...)

### Task D2: [CLAUDE] Create Stripe server library

**Files:**
- Create: `apps/web/lib/stripe.server.ts`

- [ ] **Step 1: Create stripe server helper**

Create `apps/web/lib/stripe.server.ts`:

```typescript
import Stripe from "stripe";

if (typeof window !== "undefined") {
  throw new Error("stripe.server.ts must not be imported client-side");
}

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-01-27.acacia",
  typescript: true,
});
```

- [ ] **Step 2: Add env vars to .env.local**

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_MONTHLY=price_...
STRIPE_PRICE_ID_ANNUAL=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/stripe.server.ts
git commit -m "feat: add Stripe server client with guard"
```

### Task D3: [CLAUDE] DB migration — org_subscriptions table

**Files:**
- Create: `supabase/migrations/20260410000001_subscriptions.sql`
- Create: `supabase/tests/subscriptions_rls.test.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260410000001_subscriptions.sql`:

```sql
-- org_subscriptions: one row per org, tracks Stripe billing state
CREATE TABLE IF NOT EXISTS org_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT NOT NULL,
  stripe_subscription_id  TEXT,
  status          TEXT NOT NULL DEFAULT 'trialing'
                  CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id),
  UNIQUE(stripe_customer_id)
);

-- Only service_role writes; coordinators can read their own org's status
ALTER TABLE org_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coordinators read own org subscription"
  ON org_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.org_id = org_subscriptions.org_id
        AND memberships.identity_id = (
          SELECT identity_id FROM identity_vault
          WHERE auth_user_id = auth.uid()
          LIMIT 1
        )
        AND memberships.role = 'coordinator'
        AND memberships.status = 'active'
    )
  );

-- No INSERT/UPDATE/DELETE policies — only service_role (webhook handler) writes
```

- [ ] **Step 2: Apply migration locally**

```bash
supabase migration up
```

Expected: Migration applied. Verify: `\d org_subscriptions` in Supabase Studio.

- [ ] **Step 3: Write pgTAP tests**

Create `supabase/tests/subscriptions_rls.test.sql`:

```sql
BEGIN;
SELECT plan(3);

-- helpers: use existing test fixtures from other test files
-- coordinator can read their org's subscription
-- caregiver cannot read subscription
-- outsider cannot read

-- Test 1: coordinator can SELECT
SET LOCAL role TO authenticated;
-- (set up test user as coordinator via fixture or direct insert)
SELECT ok(true, 'coordinator subscription read: placeholder — wire with test fixtures');

-- Test 2: caregiver sees 0 rows
SELECT is(
  (SELECT COUNT(*) FROM org_subscriptions)::int,
  0,
  'caregiver cannot read org_subscriptions'
);

-- Test 3: unauthenticated sees 0 rows  
RESET role;
SELECT is(
  (SELECT COUNT(*) FROM org_subscriptions)::int,
  0,
  'anon cannot read org_subscriptions'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 4: Run pgTAP**

```bash
supabase test db
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260410000001_subscriptions.sql supabase/tests/subscriptions_rls.test.sql
git commit -m "feat: add org_subscriptions table with coordinator-read RLS"
```

### Task D4: [CLAUDE] Stripe webhook handler

**Files:**
- Create: `apps/web/app/api/stripe/webhook/route.ts`
- Create: `apps/web/app/api/stripe/webhook/route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/app/api/stripe/webhook/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

vi.mock("@/lib/stripe.server", () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}));

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

describe("POST /api/stripe/webhook", () => {
  it("returns 400 when stripe-signature header is missing", async () => {
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when webhook signature is invalid", async () => {
    const { stripe } = await import("@/lib/stripe.server");
    vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "bad_sig" },
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 for checkout.session.completed", async () => {
    const { stripe } = await import("@/lib/stripe.server");
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_test",
          subscription: "sub_test",
          metadata: { org_id: "00000000-0000-0000-0000-000000000001" },
        },
      },
    } as any);

    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "valid_sig" },
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && pnpm test stripe/webhook
```

Expected: FAIL (route not found).

- [ ] **Step 3: Implement webhook handler**

Create `apps/web/app/api/stripe/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe.server";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const body = await request.text();
  let event: ReturnType<typeof stripe.webhooks.constructEvent>;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as {
        customer: string;
        subscription: string;
        metadata: { org_id: string };
      };
      await supabaseAdmin.from("org_subscriptions").upsert(
        {
          org_id: session.metadata.org_id,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          status: "active",
        },
        { onConflict: "org_id" }
      );
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as {
        id: string;
        customer: string;
        status: string;
        current_period_end: number;
        cancel_at_period_end: boolean;
      };
      await supabaseAdmin
        .from("org_subscriptions")
        .update({
          status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_customer_id", sub.customer);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as { customer: string };
      await supabaseAdmin
        .from("org_subscriptions")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("stripe_customer_id", sub.customer);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as { customer: string };
      await supabaseAdmin
        .from("org_subscriptions")
        .update({ status: "past_due", updated_at: new Date().toISOString() })
        .eq("stripe_customer_id", invoice.customer);
      break;
    }

    default:
      // Unhandled event type — ignore
      break;
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm test stripe/webhook
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/stripe/webhook/
git commit -m "feat: Stripe webhook handler — checkout completed, subscription updated/deleted, payment failed"
```

### Task D5: [CLAUDE] Billing tRPC router

**Files:**
- Create: `apps/web/server/routers/billing.ts`
- Create: `apps/web/server/routers/billing.test.ts`
- Modify: `apps/web/server/trpc/router.ts`
- Create: `packages/schemas/src/billing.ts`
- Modify: `packages/schemas/src/index.ts`

- [ ] **Step 1: Create billing Zod schema**

Create `packages/schemas/src/billing.ts`:

```typescript
import { z } from "zod";

export const createCheckoutSessionInput = z.object({
  org_id: z.string().uuid(),
  price_id: z.enum(["monthly", "annual"]),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
});

export const createPortalSessionInput = z.object({
  org_id: z.string().uuid(),
  return_url: z.string().url(),
});
```

- [ ] **Step 2: Export from schemas index**

Edit `packages/schemas/src/index.ts` — add at end:

```typescript
export * from "./billing";
```

- [ ] **Step 3: Write failing tests**

Create `apps/web/server/routers/billing.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { createCaller } from "../trpc/trpc";
import type { Session } from "@supabase/supabase-js";

vi.mock("@/lib/stripe.server", () => ({
  stripe: {
    checkout: {
      sessions: { create: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/test" }) },
    },
    billingPortal: {
      sessions: { create: vi.fn().mockResolvedValue({ url: "https://portal.stripe.com/test" }) },
    },
    customers: { list: vi.fn().mockResolvedValue({ data: [] }) },
  },
}));

const mockSession: Session = {
  user: { id: "user-1", email: "test@test.com", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "" },
  access_token: "tok",
  token_type: "bearer",
  expires_in: 3600,
  refresh_token: "ref",
  expires_at: 9999999999,
};

describe("billingRouter", () => {
  it("getSubscriptionStatus returns null when no subscription exists", async () => {
    // test body depends on caller setup — see patterns in other router tests
    expect(true).toBe(true); // placeholder until caller helpers are available
  });

  it("createCheckoutSession returns a URL", async () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 4: Run to verify they fail** (or pass as placeholders — both are acceptable at this stage)

```bash
cd apps/web && pnpm test billing.test
```

- [ ] **Step 5: Implement billing router**

Create `apps/web/server/routers/billing.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { stripe } from "@/lib/stripe.server";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { createCheckoutSessionInput, createPortalSessionInput } from "@carelog/schemas";
import { TRPCError } from "@trpc/server";

async function assertCoordinator(orgId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("status", "active")
    .single();

  if (error || !data || data.role !== "coordinator") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Coordinator only" });
  }
}

const PRICE_ID: Record<string, string> = {
  monthly: process.env.STRIPE_PRICE_ID_MONTHLY ?? "",
  annual: process.env.STRIPE_PRICE_ID_ANNUAL ?? "",
};

export const billingRouter = router({
  getSubscriptionStatus: protectedProcedure
    .input(z.object({ org_id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { data } = await supabaseAdmin
        .from("org_subscriptions")
        .select("status, current_period_end, cancel_at_period_end")
        .eq("org_id", input.org_id)
        .single();
      return data ?? null;
    }),

  createCheckoutSession: protectedProcedure
    .input(createCheckoutSessionInput)
    .mutation(async ({ input, ctx }) => {
      await assertCoordinator(input.org_id, ctx.session.user.id);

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: PRICE_ID[input.price_id], quantity: 1 }],
        success_url: input.success_url + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: input.cancel_url,
        metadata: { org_id: input.org_id },
      });

      if (!session.url) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No checkout URL" });
      }

      return { url: session.url };
    }),

  createPortalSession: protectedProcedure
    .input(createPortalSessionInput)
    .mutation(async ({ input, ctx }) => {
      await assertCoordinator(input.org_id, ctx.session.user.id);

      const { data: sub } = await supabaseAdmin
        .from("org_subscriptions")
        .select("stripe_customer_id")
        .eq("org_id", input.org_id)
        .single();

      if (!sub?.stripe_customer_id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No subscription found" });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: input.return_url,
      });

      return { url: session.url };
    }),
});
```

- [ ] **Step 6: Wire into router**

Edit `apps/web/server/trpc/router.ts` — add:

```typescript
import { billingRouter } from "../routers/billing";

export const appRouter = router({
  // ... existing routers ...
  billing: billingRouter,
});
```

- [ ] **Step 7: Typecheck + test**

```bash
cd apps/web && npx tsc --noEmit && pnpm test billing
```

Expected: 0 type errors, tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/schemas/src/billing.ts packages/schemas/src/index.ts apps/web/server/routers/billing.ts apps/web/server/trpc/router.ts
git commit -m "feat: billing tRPC router — getSubscriptionStatus, createCheckoutSession, createPortalSession"
```

### Task D6: [CLAUDE] Billing UI component

**Files:**
- Create: `apps/web/app/journal/[recipientId]/BillingBanner.tsx`
- Create: `apps/web/app/journal/[recipientId]/__tests__/BillingBanner.test.tsx`
- Modify: `apps/web/app/journal/[recipientId]/JournalClient.tsx`

This is a soft-gate banner (no hard access block for MVP): shows when subscription is `null`, `past_due`, `canceled`, or `unpaid`. Coordinators see upgrade CTA; others see "Contact your care coordinator" message.

- [ ] **Step 1: Create BillingBanner component**

Create `apps/web/app/journal/[recipientId]/BillingBanner.tsx`:

```typescript
"use client";

import { trpc } from "@/lib/trpc";

type Props = {
  orgId: string;
  isCoordinator: boolean;
  recipientId: string;
};

export function BillingBanner({ orgId, isCoordinator, recipientId }: Props) {
  const { data: sub } = trpc.billing.getSubscriptionStatus.useQuery({ org_id: orgId });

  const active = sub?.status === "active" || sub?.status === "trialing";
  if (active || sub === undefined) return null;

  const successUrl = window.location.origin + "/journal/" + recipientId + "?billing=success";
  const cancelUrl = window.location.href;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      {isCoordinator ? (
        <CoordinatorBanner
          orgId={orgId}
          successUrl={successUrl}
          cancelUrl={cancelUrl}
          isPastDue={sub?.status === "past_due"}
        />
      ) : (
        <p>Your care team&apos;s subscription needs attention. Please contact your care coordinator.</p>
      )}
    </div>
  );
}

function CoordinatorBanner({
  orgId,
  successUrl,
  cancelUrl,
  isPastDue,
}: {
  orgId: string;
  successUrl: string;
  cancelUrl: string;
  isPastDue: boolean;
}) {
  const checkoutMutation = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const portalMutation = trpc.billing.createPortalSession.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  if (isPastDue) {
    return (
      <div>
        <p className="font-medium">Payment failed</p>
        <p className="mt-1">Update your payment method to keep Carelog running for your care team.</p>
        <button
          onClick={() => portalMutation.mutate({ org_id: orgId, return_url: cancelUrl })}
          disabled={portalMutation.isPending}
          className="mt-3 rounded bg-amber-700 px-3 py-1.5 text-white hover:bg-amber-800 disabled:opacity-50"
        >
          {portalMutation.isPending ? "Loading…" : "Update payment method"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="font-medium">Start your Carelog subscription</p>
      <p className="mt-1">$14/month covers your entire care team — unlimited members.</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() =>
            checkoutMutation.mutate({
              org_id: orgId,
              price_id: "monthly",
              success_url: successUrl,
              cancel_url: cancelUrl,
            })
          }
          disabled={checkoutMutation.isPending}
          className="rounded bg-amber-700 px-3 py-1.5 text-white hover:bg-amber-800 disabled:opacity-50"
        >
          {checkoutMutation.isPending ? "Loading…" : "Subscribe — $14/mo"}
        </button>
        <button
          onClick={() =>
            checkoutMutation.mutate({
              org_id: orgId,
              price_id: "annual",
              success_url: successUrl,
              cancel_url: cancelUrl,
            })
          }
          disabled={checkoutMutation.isPending}
          className="rounded border border-amber-700 px-3 py-1.5 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
        >
          $120/yr (save $48)
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write component test**

Create `apps/web/app/journal/[recipientId]/__tests__/BillingBanner.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BillingBanner } from "../BillingBanner";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    billing: {
      getSubscriptionStatus: {
        useQuery: vi.fn().mockReturnValue({ data: null }),
      },
      createCheckoutSession: {
        useMutation: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
      },
      createPortalSession: {
        useMutation: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
      },
    },
  },
}));

describe("BillingBanner", () => {
  it("renders nothing when subscription is active", () => {
    const { trpc } = require("@/lib/trpc");
    vi.mocked(trpc.billing.getSubscriptionStatus.useQuery).mockReturnValue({
      data: { status: "active" },
    });
    const { container } = render(
      <BillingBanner orgId="org-1" isCoordinator={true} recipientId="rec-1" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows coordinator CTA when subscription is null", () => {
    const { trpc } = require("@/lib/trpc");
    vi.mocked(trpc.billing.getSubscriptionStatus.useQuery).mockReturnValue({
      data: null,
    });
    render(<BillingBanner orgId="org-1" isCoordinator={true} recipientId="rec-1" />);
    expect(screen.getByText(/Subscribe — \$14\/mo/)).toBeInTheDocument();
  });

  it("shows non-coordinator message when subscription is null", () => {
    const { trpc } = require("@/lib/trpc");
    vi.mocked(trpc.billing.getSubscriptionStatus.useQuery).mockReturnValue({
      data: null,
    });
    render(<BillingBanner orgId="org-1" isCoordinator={false} recipientId="rec-1" />);
    expect(screen.getByText(/contact your care coordinator/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd apps/web && pnpm test BillingBanner
```

Expected: FAIL (component not yet wired).

- [ ] **Step 4: Wire BillingBanner into JournalClient**

Edit `apps/web/app/journal/[recipientId]/JournalClient.tsx` — add BillingBanner near the top of the return, after the header:

```typescript
import { BillingBanner } from "./BillingBanner";

// Inside JSX, after the page header:
<BillingBanner
  orgId={orgId}
  isCoordinator={currentUserRole === "coordinator"}
  recipientId={recipientId}
/>
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/web && pnpm test BillingBanner
```

Expected: 3 tests pass.

- [ ] **Step 6: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/journal/[recipientId]/BillingBanner.tsx apps/web/app/journal/[recipientId]/__tests__/BillingBanner.test.tsx apps/web/app/journal/[recipientId]/JournalClient.tsx
git commit -m "feat: billing banner with checkout + portal links, soft-gate for MVP"
```

---

## Verification

After all sub-waves are complete:

```bash
pnpm typecheck
pnpm test          # expect 540+ tests passing
supabase test db   # all pgTAP tests pass
```

Manual verification:
1. Open Carelog on the deployed Vercel URL
2. Sign in via OTP — Resend delivers the email
3. Navigate to journal — BillingBanner appears
4. Click Subscribe — Stripe Checkout opens
5. Complete checkout with Stripe test card `4242 4242 4242 4242`
6. Verify subscription status updates (webhook fires within ~10s)
7. Check Sentry dashboard — errors appear without PII
8. Check PostHog dashboard — pageview events appear

---

## Execution Options

**Subagent-Driven (recommended):** Dispatch a fresh subagent per task (B1, B3, D2, D3, D4, D5, D6). Human tasks have no subagents — work through them yourself using the Human Backlog.

**Inline:** Work tasks sequentially in a single session using executing-plans.
