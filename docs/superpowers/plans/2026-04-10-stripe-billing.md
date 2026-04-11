# Stripe Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up Stripe billing — hosted Checkout for $14/mo and $120/yr Family Plan, webhook handler, billing settings page, and pricing page updates.

**Architecture:** 4 API routes (checkout, webhook, verify, portal), 2 new pages (billing settings, success), pricing page update with sessionStorage bridge to DashboardClient. Webhook uses `supabaseAdmin` to update org plan. No feature gating in v1.

**Tech Stack:** Stripe SDK (v14.14.0, already installed), Next.js 16 API routes, Supabase

**Spec:** `docs/superpowers/specs/2026-04-10-stripe-billing-design.md`

---

## Context for all tasks

**Key patterns:**
- Auth in API routes: `import { getRequestUser } from '@/lib/supabaseServer'` → `const user = await getRequestUser(request)` → returns `User | null`
- Admin queries: `import { supabaseAdmin } from '@/server/supabaseAdmin.server'`
- Response format: `NextResponse.json({ error: 'msg' }, { status: 401 })` for errors, `NextResponse.json({ url })` for success
- Route params are async in Next.js 16: `const { id } = await params`
- Zod validation on request bodies
- `apps/web/CLAUDE.md` rules: no `createServerSupabase()` in pages, use API routes for cookie+redirect ops

**Database:**
- `organizations` table has `plan` (enum: free|family|professional|enterprise) and `stripe_id` (text, nullable)
- Update via `supabaseAdmin.from('organizations').update({ plan, stripe_id }).eq('id', orgId)`

---

## Task 1: Stripe client + env vars

**Files:**
- Create: `apps/web/lib/stripe.ts`
- Modify: `apps/web/.env.example`

### Step 1: Create Stripe client singleton

- [ ] Create `apps/web/lib/stripe.ts`:

```ts
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
})
```

### Step 2: Update .env.example

- [ ] Add to `apps/web/.env.example` after the `STRIPE_SECRET_KEY=` line:

```
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_MONTHLY=
STRIPE_PRICE_ANNUAL=
```

### Step 3: Commit

- [ ] ```bash
git add apps/web/lib/stripe.ts apps/web/.env.example
git commit -m "feat(billing): Stripe client singleton + env vars"
```

---

## Task 2: Checkout API route + tests (TDD)

**Files:**
- Create: `apps/web/app/api/stripe/__tests__/checkout.test.ts`
- Create: `apps/web/app/api/stripe/checkout/route.ts`

### Step 1: Write failing tests

- [ ] Create `apps/web/app/api/stripe/__tests__/checkout.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Mocks ---
const mockGetRequestUser = vi.fn()
vi.mock('@/lib/supabaseServer', () => ({
  getRequestUser: (...args: unknown[]) => mockGetRequestUser(...args),
}))

const mockSupabaseFrom = vi.fn()
const mockSupabaseAdmin = { from: mockSupabaseFrom }
vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}))

const mockCheckoutCreate = vi.fn()
const mockCustomerCreate = vi.fn()
vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { create: (...args: unknown[]) => mockCheckoutCreate(...args) } },
    customers: { create: (...args: unknown[]) => mockCustomerCreate(...args) },
  },
}))

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/stripe/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Helper: set up valid coordinator with free org
function setupCoordinator(overrides?: { plan?: string; stripe_id?: string | null }) {
  mockGetRequestUser.mockResolvedValue({ id: 'user-1', email: 'a@b.com' })
  // Membership lookup
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'memberships') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: 'coordinator' },
                error: null,
              }),
            }),
          }),
        }),
      }
    }
    if (table === 'organizations') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'org-1',
                name: 'Test Org',
                plan: overrides?.plan ?? 'free',
                stripe_id: overrides?.stripe_id ?? null,
              },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }
    }
    return {}
  })
}

describe('POST /api/stripe/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: mock a successful checkout session
    mockCheckoutCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/session_123',
    })
    mockCustomerCreate.mockResolvedValue({ id: 'cus_new' })
  })

  it('returns 401 without auth', async () => {
    mockGetRequestUser.mockResolvedValue(null)
    const { POST } = await import('../checkout/route')
    const res = await POST(makeRequest({ orgId: 'org-1', interval: 'month' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-coordinator', async () => {
    mockGetRequestUser.mockResolvedValue({ id: 'user-1', email: 'a@b.com' })
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: 'caregiver' },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      return {}
    })
    const { POST } = await import('../checkout/route')
    const res = await POST(makeRequest({ orgId: 'org-1', interval: 'month' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 if org already on paid plan', async () => {
    setupCoordinator({ plan: 'family' })
    const { POST } = await import('../checkout/route')
    const res = await POST(makeRequest({ orgId: 'org-1', interval: 'month' }))
    expect(res.status).toBe(400)
  })

  it('creates Stripe customer if none exists', async () => {
    setupCoordinator({ stripe_id: null })
    const { POST } = await import('../checkout/route')
    await POST(makeRequest({ orgId: 'org-1', interval: 'month' }))
    expect(mockCustomerCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.com' }),
    )
  })

  it('reuses existing Stripe customer', async () => {
    setupCoordinator({ stripe_id: 'cus_existing' })
    const { POST } = await import('../checkout/route')
    await POST(makeRequest({ orgId: 'org-1', interval: 'month' }))
    expect(mockCustomerCreate).not.toHaveBeenCalled()
  })

  it('returns checkout URL', async () => {
    setupCoordinator()
    const { POST } = await import('../checkout/route')
    const res = await POST(makeRequest({ orgId: 'org-1', interval: 'month' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.url).toBe('https://checkout.stripe.com/session_123')
  })

  it('uses monthly price for interval=month', async () => {
    setupCoordinator()
    const { POST } = await import('../checkout/route')
    await POST(makeRequest({ orgId: 'org-1', interval: 'month' }))
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: process.env.STRIPE_PRICE_MONTHLY, quantity: 1 }],
      }),
    )
  })

  it('uses annual price for interval=year', async () => {
    setupCoordinator()
    const { POST } = await import('../checkout/route')
    await POST(makeRequest({ orgId: 'org-1', interval: 'year' }))
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: process.env.STRIPE_PRICE_ANNUAL, quantity: 1 }],
      }),
    )
  })
})
```

### Step 2: Run tests to verify they fail

- [ ] Run: `cd apps/web && pnpm vitest run app/api/stripe/__tests__/checkout.test.ts`
- Expected: FAIL — cannot find module `../checkout/route`

### Step 3: Write checkout route implementation

- [ ] Create `apps/web/app/api/stripe/checkout/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getRequestUser } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { stripe } from '@/lib/stripe'

const checkoutSchema = z.object({
  orgId: z.string().uuid(),
  interval: z.enum(['month', 'year']),
})

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const { orgId, interval } = parsed.data

  // Verify caller is coordinator
  const { data: membership } = await supabaseAdmin
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'coordinator') {
    return NextResponse.json({ error: 'Only coordinators can manage billing' }, { status: 403 })
  }

  // Look up org
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, name, plan, stripe_id')
    .eq('id', orgId)
    .single()

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  if (org.plan !== 'free') {
    return NextResponse.json({ error: 'Organization already on a paid plan' }, { status: 400 })
  }

  // Get or create Stripe customer
  let customerId = org.stripe_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: org.name,
      metadata: { orgId },
    })
    customerId = customer.id
    await supabaseAdmin
      .from('organizations')
      .update({ stripe_id: customerId })
      .eq('id', orgId)
  }

  // Create Checkout Session
  const priceId = interval === 'year'
    ? process.env.STRIPE_PRICE_ANNUAL
    : process.env.STRIPE_PRICE_MONTHLY

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: origin + '/billing/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: origin + '/pricing',
    metadata: { orgId, interval },
  })

  return NextResponse.json({ url: session.url })
}
```

### Step 4: Run tests to verify they pass

- [ ] Run: `cd apps/web && pnpm vitest run app/api/stripe/__tests__/checkout.test.ts`
- Expected: 8 tests PASS

### Step 5: Commit

- [ ] ```bash
git add apps/web/app/api/stripe/checkout/route.ts apps/web/app/api/stripe/__tests__/checkout.test.ts
git commit -m "feat(billing): checkout API route + tests — creates Stripe Checkout session"
```

---

## Task 3: Webhook API route + tests (TDD)

**Files:**
- Create: `apps/web/app/api/stripe/__tests__/webhook.test.ts`
- Create: `apps/web/app/api/stripe/webhook/route.ts`

### Step 1: Write failing tests

- [ ] Create `apps/web/app/api/stripe/__tests__/webhook.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Mocks ---
const mockConstructEvent = vi.fn()
vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: (...args: unknown[]) => mockConstructEvent(...args) },
  },
}))

const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
})
const mockSupabaseFrom = vi.fn().mockImplementation(() => ({
  update: mockUpdate,
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { id: 'org-1' },
        error: null,
      }),
    }),
  }),
}))
vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockSupabaseFrom(...args) },
}))

function makeWebhookRequest(body: string, signature = 'sig_valid') {
  return new NextRequest('http://localhost:3000/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature,
    },
    body,
  })
}

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  })

  it('rejects invalid signature', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })
    const { POST } = await import('../webhook/route')
    const res = await POST(makeWebhookRequest('{}', 'bad_sig'))
    expect(res.status).toBe(400)
  })

  it('checkout.session.completed updates org to family plan', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_123',
          metadata: { orgId: 'org-1' },
        },
      },
    })
    const { POST } = await import('../webhook/route')
    const res = await POST(makeWebhookRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockSupabaseFrom).toHaveBeenCalledWith('organizations')
    expect(mockUpdate).toHaveBeenCalledWith({
      plan: 'family',
      stripe_id: 'cus_123',
    })
  })

  it('customer.subscription.deleted resets org to free', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: { customer: 'cus_123' },
      },
    })
    const { POST } = await import('../webhook/route')
    const res = await POST(makeWebhookRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({
      plan: 'free',
      stripe_id: null,
    })
  })

  it('invoice.payment_failed returns 200 without DB change', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: { object: { customer: 'cus_123' } },
    })
    const { POST } = await import('../webhook/route')
    const res = await POST(makeWebhookRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('unknown event returns 200', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'some.unknown.event',
      data: { object: {} },
    })
    const { POST } = await import('../webhook/route')
    const res = await POST(makeWebhookRequest('{}'))
    expect(res.status).toBe(200)
  })
})
```

### Step 2: Run tests to verify they fail

- [ ] Run: `cd apps/web && pnpm vitest run app/api/stripe/__tests__/webhook.test.ts`
- Expected: FAIL — cannot find module `../webhook/route`

### Step 3: Write webhook route implementation

- [ ] Create `apps/web/app/api/stripe/webhook/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature') ?? ''

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const orgId = session.metadata?.orgId
      if (orgId) {
        await supabaseAdmin
          .from('organizations')
          .update({ plan: 'family', stripe_id: session.customer as string })
          .eq('id', orgId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      const customerId = subscription.customer as string
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('stripe_id', customerId)
        .single()

      if (org) {
        await supabaseAdmin
          .from('organizations')
          .update({ plan: 'free', stripe_id: null })
          .eq('id', org.id)
      }
      break
    }

    case 'invoice.payment_failed': {
      // v1: log only, no action
      console.warn('Stripe invoice.payment_failed for customer:', event.data.object.customer)
      break
    }
  }

  return NextResponse.json({ received: true })
}
```

### Step 4: Run tests to verify they pass

- [ ] Run: `cd apps/web && pnpm vitest run app/api/stripe/__tests__/webhook.test.ts`
- Expected: 5 tests PASS

### Step 5: Commit

- [ ] ```bash
git add apps/web/app/api/stripe/webhook/route.ts apps/web/app/api/stripe/__tests__/webhook.test.ts
git commit -m "feat(billing): webhook route + tests — handles checkout, cancellation, payment failure"
```

---

## Task 4: Verify + Portal API routes

**Files:**
- Create: `apps/web/app/api/stripe/verify/route.ts`
- Create: `apps/web/app/api/stripe/portal/route.ts`
- Create: `apps/web/app/api/stripe/__tests__/portal.test.ts`

### Step 1: Create verify route

- [ ] Create `apps/web/app/api/stripe/verify/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { getRequestUser } from '@/lib/supabaseServer'
import { stripe } from '@/lib/stripe'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionId = request.nextUrl.searchParams.get('session_id')
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    return NextResponse.json({
      status: session.payment_status,
      plan: 'family',
      interval: session.metadata?.interval ?? 'month',
    })
  } catch {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }
}
```

### Step 2: Write portal test

- [ ] Create `apps/web/app/api/stripe/__tests__/portal.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetRequestUser = vi.fn()
vi.mock('@/lib/supabaseServer', () => ({
  getRequestUser: (...args: unknown[]) => mockGetRequestUser(...args),
}))

const mockSupabaseFrom = vi.fn()
vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockSupabaseFrom(...args) },
}))

const mockPortalCreate = vi.fn()
vi.mock('@/lib/stripe', () => ({
  stripe: {
    billingPortal: { sessions: { create: (...args: unknown[]) => mockPortalCreate(...args) } },
  },
}))

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/stripe/portal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/stripe/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPortalCreate.mockResolvedValue({ url: 'https://billing.stripe.com/session_456' })
  })

  it('returns 401 without auth', async () => {
    mockGetRequestUser.mockResolvedValue(null)
    const { POST } = await import('../portal/route')
    const res = await POST(makeRequest({ orgId: 'org-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-coordinator', async () => {
    mockGetRequestUser.mockResolvedValue({ id: 'user-1' })
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: 'caregiver' },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      return {}
    })
    const { POST } = await import('../portal/route')
    const res = await POST(makeRequest({ orgId: 'org-1' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 if org has no stripe_id', async () => {
    mockGetRequestUser.mockResolvedValue({ id: 'user-1' })
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: 'coordinator' },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'org-1', stripe_id: null },
                error: null,
              }),
            }),
          }),
        }
      }
      return {}
    })
    const { POST } = await import('../portal/route')
    const res = await POST(makeRequest({ orgId: 'org-1' }))
    expect(res.status).toBe(400)
  })

  it('returns portal URL', async () => {
    mockGetRequestUser.mockResolvedValue({ id: 'user-1' })
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: 'coordinator' },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'org-1', stripe_id: 'cus_123' },
                error: null,
              }),
            }),
          }),
        }
      }
      return {}
    })
    const { POST } = await import('../portal/route')
    const res = await POST(makeRequest({ orgId: 'org-1' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.url).toBe('https://billing.stripe.com/session_456')
  })
})
```

### Step 3: Create portal route

- [ ] Create `apps/web/app/api/stripe/portal/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getRequestUser } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { stripe } from '@/lib/stripe'

const portalSchema = z.object({
  orgId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = portalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const { orgId } = parsed.data

  // Verify coordinator
  const { data: membership } = await supabaseAdmin
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'coordinator') {
    return NextResponse.json({ error: 'Only coordinators can manage billing' }, { status: 403 })
  }

  // Look up org stripe_id
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, stripe_id')
    .eq('id', orgId)
    .single()

  if (!org?.stripe_id) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
  }

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_id,
    return_url: origin + '/billing',
  })

  return NextResponse.json({ url: session.url })
}
```

### Step 4: Run tests

- [ ] Run: `cd apps/web && pnpm vitest run app/api/stripe/__tests__/portal.test.ts`
- Expected: 4 tests PASS

### Step 5: Commit

- [ ] ```bash
git add apps/web/app/api/stripe/verify/route.ts apps/web/app/api/stripe/portal/route.ts apps/web/app/api/stripe/__tests__/portal.test.ts
git commit -m "feat(billing): verify + portal API routes — session verification and subscription management"
```

---

## Task 5: Pricing page — monthly/annual toggle + sessionStorage

**Files:**
- Modify: `apps/web/components/marketing/PricingCards.tsx`

### Step 1: Rewrite PricingCards with toggle

- [ ] Replace `apps/web/components/marketing/PricingCards.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FREE_FEATURES = [
  "1 caregiver account",
  "Care journal",
  "7-day history",
];

const FAMILY_FEATURES = [
  "Unlimited team members",
  "Full care journal + reactions",
  "Medications & shifts",
  "Documents vault",
  "Weekly email digest",
  "Unlimited history",
];

export function PricingCards() {
  const router = useRouter();
  const [interval, setInterval] = useState<"month" | "year">("month");

  function handleSubscribe() {
    sessionStorage.setItem(
      "pendingPlan",
      JSON.stringify({ plan: "family", interval }),
    );
    router.push("/signin");
  }

  return (
    <div>
      {/* Toggle */}
      <div className="mx-auto mb-10 flex items-center justify-center gap-3">
        <button
          onClick={() => setInterval("month")}
          className={
            "rounded-lg px-4 py-2 text-sm font-semibold transition-colors " +
            (interval === "month"
              ? "bg-[var(--color-primary)] text-white"
              : "text-[var(--color-muted)] hover:text-[var(--color-ink)]")
          }
        >
          Monthly
        </button>
        <button
          onClick={() => setInterval("year")}
          className={
            "rounded-lg px-4 py-2 text-sm font-semibold transition-colors " +
            (interval === "year"
              ? "bg-[var(--color-primary)] text-white"
              : "text-[var(--color-muted)] hover:text-[var(--color-ink)]")
          }
        >
          Annual
          <span className="ml-1.5 rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-xs font-bold text-[var(--color-success)]">
            Save 29%
          </span>
        </button>
      </div>

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 md:flex-row">
        {/* Free tier */}
        <div className="flex flex-1 flex-col rounded-2xl border border-[var(--color-border)] bg-white p-8">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-[var(--color-ink)]">Free</h3>
            <div className="mt-2 flex items-end gap-1">
              <span className="text-4xl font-extrabold text-[var(--color-muted)]">
                $0
              </span>
              <span className="mb-1 text-sm text-[var(--color-muted)]">
                /mo
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Get started, no commitment.
            </p>
          </div>
          <ul className="mb-8 flex flex-col gap-3" role="list">
            {FREE_FEATURES.map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 text-sm text-[var(--color-muted)]"
              >
                <span className="text-[var(--color-success)]" aria-hidden="true">
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>
          <a
            href="/signin"
            className="mt-auto inline-flex items-center justify-center rounded-xl border-2 border-[var(--color-border)] px-6 py-3 text-sm font-semibold text-[var(--color-muted)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            Get started
          </a>
        </div>

        {/* Family Plan */}
        <div className="relative flex flex-1 flex-col rounded-2xl border-2 border-[var(--color-primary)] bg-white p-8">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-primary)] px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            Most popular
          </span>
          <div className="mb-6">
            <h3 className="text-lg font-bold text-[var(--color-ink)]">
              Family Plan
            </h3>
            <div className="mt-2 flex items-end gap-1">
              <span className="text-4xl font-extrabold text-[var(--color-primary)]">
                {interval === "month" ? "$14" : "$120"}
              </span>
              <span className="mb-1 text-sm text-[var(--color-muted)]">
                {interval === "month" ? "/mo" : "/yr"}
              </span>
            </div>
            {interval === "year" && (
              <p className="mt-1 text-sm font-medium text-[var(--color-success)]">
                $10/mo — save $48/yr
              </p>
            )}
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Everything for the whole family team.
            </p>
          </div>
          <ul className="mb-8 flex flex-col gap-3" role="list">
            {FAMILY_FEATURES.map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 text-sm text-[var(--color-ink)]"
              >
                <span className="text-[var(--color-success)]" aria-hidden="true">
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={handleSubscribe}
            className="mt-auto inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            Subscribe
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Run typecheck

- [ ] Run: `cd apps/web && npx tsc --noEmit 2>&1 | tail -10`
- Expected: No errors

### Step 3: Commit

- [ ] ```bash
git add apps/web/components/marketing/PricingCards.tsx
git commit -m "feat(billing): pricing page — monthly/annual toggle + sessionStorage bridge"
```

---

## Task 6: DashboardClient pendingPlan redirect

**Files:**
- Modify: `apps/web/app/(app)/dashboard/DashboardClient.tsx`

### Step 1: Add pendingPlan check after invite check

- [ ] In `apps/web/app/(app)/dashboard/DashboardClient.tsx`, find the block after the `pendingInvite` check (around line 43-44, after `return;` from the invite redirect). Add the following block immediately after:

```tsx
      // Pending billing bridge: pricing page stores selected plan in sessionStorage
      // before redirecting to /signin. After sign-in, we check for it here and
      // redirect to Stripe Checkout.
      const pendingPlan = sessionStorage.getItem("pendingPlan");
      if (pendingPlan) {
        sessionStorage.removeItem("pendingPlan");
        try {
          const { interval } = JSON.parse(pendingPlan);
          // Need org to create checkout — fetch memberships first, then use first org
          const { data: memberships } = await supabase
            .from("memberships")
            .select("org_id")
            .eq("user_id", user.id)
            .not("accepted_at", "is", null)
            .limit(1);

          if (memberships && memberships[0]) {
            const res = await fetch("/api/stripe/checkout", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                orgId: memberships[0].org_id,
                interval: interval ?? "month",
              }),
            });
            if (res.ok) {
              const { url } = await res.json();
              window.location.href = url;
              return;
            }
          }
        } catch {
          // If checkout fails, continue to dashboard normally
        }
      }
```

### Step 2: Run typecheck

- [ ] Run: `cd apps/web && npx tsc --noEmit 2>&1 | tail -10`
- Expected: No errors

### Step 3: Commit

- [ ] ```bash
git add apps/web/app/\(app\)/dashboard/DashboardClient.tsx
git commit -m "feat(billing): DashboardClient pendingPlan redirect — sessionStorage bridge to Stripe Checkout"
```

---

## Task 7: Billing pages — success + settings

**Files:**
- Create: `apps/web/app/(app)/billing/success/page.tsx`
- Create: `apps/web/app/(app)/billing/page.tsx`

### Step 1: Create billing success page

- [ ] Create `apps/web/app/(app)/billing/success/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<"loading" | "paid" | "error">(
    "loading",
  );
  const [interval, setInterval] = useState("month");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    fetch("/api/stripe/verify?session_id=" + sessionId)
      .then((res) => {
        if (!res.ok) throw new Error("verify failed");
        return res.json();
      })
      .then((data) => {
        if (data.status === "paid") {
          setStatus("paid");
          setInterval(data.interval);
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [sessionId]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[var(--color-muted)]">Confirming your subscription...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-sm text-center">
          <CardHeader>
            <p className="text-lg font-bold text-[var(--color-ink)]">
              Something went wrong
            </p>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              We couldn&apos;t confirm your subscription. Please check your
              email for a receipt from Stripe.
            </p>
            <Button asChild>
              <a href="/dashboard">Go to dashboard</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const planLabel = interval === "year" ? "$120/yr" : "$14/mo";

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-sm text-center">
        <CardHeader>
          <p className="text-2xl font-bold text-[var(--color-ink)]">
            Welcome to the Family Plan!
          </p>
        </CardHeader>
        <CardContent>
          <p className="mb-6 text-sm text-[var(--color-muted)]">
            Your subscription ({planLabel}) is active. Your entire care team now
            has full access.
          </p>
          <Button asChild>
            <a href="/dashboard">Go to dashboard</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 2: Create billing settings page

- [ ] Create `apps/web/app/(app)/billing/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<{
    id: string;
    name: string;
    plan: string;
    stripe_id: string | null;
  } | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        window.location.href = "/signin";
        return;
      }

      const { data: membership } = await supabase
        .from("memberships")
        .select("org_id, role, organizations(id, name, plan, stripe_id)")
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .limit(1)
        .single();

      if (membership) {
        const orgData = membership.organizations as unknown as {
          id: string;
          name: string;
          plan: string;
          stripe_id: string | null;
        };
        setOrg(orgData);
        setRole(membership.role);
      }
      setLoading(false);
    });
  }, []);

  async function handleManage() {
    if (!org) return;
    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orgId: org.id }),
    });
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
    }
  }

  async function handleUpgrade(interval: "month" | "year") {
    if (!org) return;
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orgId: org.id, interval }),
    });
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[var(--color-muted)]">Loading...</p>
      </div>
    );
  }

  if (role !== "coordinator") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-sm text-center">
          <CardContent className="pt-6">
            <p className="text-sm text-[var(--color-muted)]">
              Contact your coordinator to manage billing.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPaid = org?.plan !== "free";

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold text-[var(--color-ink)]">
        Billing
      </h1>

      <Card>
        <CardHeader>
          <p className="text-lg font-bold text-[var(--color-ink)]">
            {isPaid ? "Family Plan" : "Free Plan"}
          </p>
        </CardHeader>
        <CardContent>
          {isPaid ? (
            <div>
              <p className="mb-4 text-sm text-[var(--color-muted)]">
                Your team has full access to all Carelog features.
              </p>
              <Button onClick={handleManage}>Manage subscription</Button>
            </div>
          ) : (
            <div>
              <p className="mb-4 text-sm text-[var(--color-muted)]">
                Upgrade to unlock unlimited team members, medications, shifts,
                documents, and more.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => handleUpgrade("month")}>
                  $14/mo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleUpgrade("year")}
                >
                  $120/yr (save 29%)
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 3: Run typecheck

- [ ] Run: `cd apps/web && npx tsc --noEmit 2>&1 | tail -10`
- Expected: No errors

### Step 4: Commit

- [ ] ```bash
git add "apps/web/app/(app)/billing/"
git commit -m "feat(billing): billing success + settings pages — plan display, upgrade, manage subscription"
```

---

## Summary

| Task | Files | What it does |
|------|-------|-------------|
| 1 | `lib/stripe.ts`, `.env.example` | Stripe client singleton + env vars |
| 2 | `api/stripe/checkout/route.ts`, tests | Creates Checkout Session (TDD, 8 tests) |
| 3 | `api/stripe/webhook/route.ts`, tests | Handles subscription lifecycle (TDD, 5 tests) |
| 4 | `api/stripe/verify/route.ts`, `api/stripe/portal/route.ts`, tests | Session verification + billing portal (4 tests) |
| 5 | `PricingCards.tsx` | Monthly/annual toggle + sessionStorage bridge |
| 6 | `DashboardClient.tsx` | PendingPlan redirect to Stripe Checkout |
| 7 | `billing/success/page.tsx`, `billing/page.tsx` | Success confirmation + billing settings |

Total: 12 files (8 create, 2 modify, 2 existing test files). 17 tests across 3 test files.
