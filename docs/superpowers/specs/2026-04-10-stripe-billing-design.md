# Stripe Billing — Design Spec

## Goal

Wire up Stripe billing so users can subscribe to the Family Plan ($14/mo or $120/yr) via hosted Stripe Checkout. No feature gating in v1 — just payment plumbing, webhook handling, and a billing settings page.

## Scope

**In scope:**
- Stripe Checkout (hosted) for monthly and annual subscriptions
- Webhook handler for subscription lifecycle events
- Billing settings page (current plan, manage subscription via Stripe Portal)
- Pricing page updated with monthly/annual toggle + sessionStorage bridge to checkout
- DashboardClient pendingPlan redirect (same pattern as invite flow)
- Billing success confirmation page

**Out of scope:**
- Feature gating by plan (v2)
- Professional/enterprise tiers (v2)
- Proration, plan changes, coupon codes
- Mobile billing (Apple/Google IAP)

---

## Checkout Flow

1. **Pricing page** — user clicks "Family Plan" ($14/mo or $120/yr toggle)
2. Button stores `{ plan: 'family', interval: 'month' | 'year' }` in sessionStorage key `pendingPlan`
3. Redirects to `/signin`
4. **After sign-in** — DashboardClient checks sessionStorage for `pendingPlan`
5. If found, calls `POST /api/stripe/checkout` with `{ orgId, interval }`
6. API creates Stripe Customer (or reuses `organizations.stripe_id`), creates Checkout Session
7. Returns `{ url }` — client redirects to Stripe hosted checkout
8. **Stripe Checkout** — user pays
9. Stripe redirects to `/billing/success?session_id=cs_...`
10. Success page calls `GET /api/stripe/verify?session_id=cs_...` to confirm
11. **Webhook** — Stripe sends `checkout.session.completed` → updates `organizations.plan` and `stripe_id`

---

## API Routes

### `POST /api/stripe/checkout`

**Auth:** Required. Caller must be coordinator of the org.

**Input:**
```ts
{ orgId: string, interval: 'month' | 'year' }
```

**Logic:**
1. Validate auth + coordinator role
2. Look up org — reject if `plan !== 'free'` (already subscribed)
3. If `stripe_id` exists, reuse as Stripe Customer. Otherwise create new Customer with org name + user email, save `stripe_id` to org.
4. Create Checkout Session:
   - `mode: 'subscription'`
   - `customer: stripe_id`
   - `line_items: [{ price: STRIPE_PRICE_MONTHLY or STRIPE_PRICE_ANNUAL, quantity: 1 }]`
   - `success_url: {origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`
   - `cancel_url: {origin}/pricing`
   - `metadata: { orgId }`
5. Return `{ url: session.url }`

**Errors:** 401 (no auth), 403 (not coordinator), 400 (already subscribed), 500 (Stripe error)

### `POST /api/stripe/webhook`

**Auth:** None (Stripe calls this). Verified via `stripe-signature` header + `STRIPE_WEBHOOK_SECRET`.

**Events handled:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Read `metadata.orgId`. Set `organizations.plan = 'family'`, `stripe_id = session.customer` |
| `customer.subscription.deleted` | Look up org by `stripe_id = event.data.object.customer`. Set `plan = 'free'`, clear `stripe_id` |
| `invoice.payment_failed` | Log warning. No action in v1. |

**Important:** Uses `supabaseAdmin` (service role) — webhook has no user session.

**Raw body:** Must read raw request body for signature verification. Export `config = { api: { bodyParser: false } }` or use Next.js 16 equivalent.

### `GET /api/stripe/verify`

**Auth:** Required.

**Input:** `session_id` query parameter.

**Logic:**
1. Retrieve Checkout Session from Stripe: `stripe.checkout.sessions.retrieve(session_id)`
2. Return `{ status: session.payment_status, plan: 'family', interval: session.metadata.interval ?? 'month' }`

**Errors:** 401 (no auth), 400 (missing session_id), 404 (invalid session)

### `POST /api/stripe/portal`

**Auth:** Required. Caller must be coordinator.

**Input:**
```ts
{ orgId: string }
```

**Logic:**
1. Validate coordinator role
2. Look up org `stripe_id` — reject if null (not subscribed)
3. Create Billing Portal session: `stripe.billingPortal.sessions.create({ customer: stripe_id, return_url: origin + '/billing' })`
4. Return `{ url: session.url }`

**Errors:** 401, 403, 400 (no subscription), 500

---

## Stripe Client

### `apps/web/lib/stripe.ts`

```ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})
```

Server-only. No window guard needed (API routes only).

---

## Environment Variables

Add to `.env.example`:
```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL=price_...
```

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is included for completeness but not used in v1 (hosted checkout doesn't need it client-side).

---

## UI

### Pricing page — `apps/web/app/(marketing)/pricing/page.tsx`

**Changes:**
- Add monthly/annual toggle at top of pricing cards
- Annual shows "$120/yr ($10/mo)" with savings badge
- "Subscribe" button on Family Plan:
  - Stores `{ plan: 'family', interval }` in sessionStorage key `pendingPlan`
  - Redirects to `/signin`
- Free tier "Get started" button unchanged (→ `/signin`)

### DashboardClient — pending plan redirect

**Changes:**
- On mount, check sessionStorage for `pendingPlan`
- If found, remove it from sessionStorage, then call `POST /api/stripe/checkout` with `{ orgId, interval }`
- Redirect to returned Stripe Checkout URL
- Pattern matches existing invite flow sessionStorage bridge

### Billing success — `apps/web/app/(app)/billing/success/page.tsx`

- Client component. Reads `session_id` from URL search params.
- Calls `GET /api/stripe/verify?session_id=...`
- Shows: "Welcome to the Family Plan!" confirmation, link to dashboard
- If verify fails, shows error state

### Billing settings — `apps/web/app/(app)/billing/page.tsx`

- Client component. Protected (auth check).
- Coordinator only — non-coordinators see "Contact your coordinator to manage billing"
- Shows current plan from org data
- If free: "Upgrade to Family Plan" button → same checkout flow
- If paid: "Manage subscription" button → calls `POST /api/stripe/portal` → redirects to Stripe
- Plan info: "Family Plan — $14/mo" or "$120/yr", next billing date (from Stripe if available)

---

## Testing

### `apps/web/app/api/stripe/__tests__/checkout.test.ts`

| Test | Assertion |
|------|-----------|
| Returns 401 without auth | Status 401 |
| Returns 403 for non-coordinator | Status 403 |
| Returns 400 if org already on paid plan | Status 400 |
| Creates Stripe customer if none exists | `stripe.customers.create` called, `stripe_id` saved |
| Reuses existing Stripe customer | `stripe.customers.create` NOT called |
| Returns checkout URL | Response has `{ url }` |
| Uses monthly price for interval=month | `line_items[0].price` matches `STRIPE_PRICE_MONTHLY` |
| Uses annual price for interval=year | `line_items[0].price` matches `STRIPE_PRICE_ANNUAL` |

### `apps/web/app/api/stripe/__tests__/webhook.test.ts`

| Test | Assertion |
|------|-----------|
| Rejects invalid signature | Status 400 |
| checkout.session.completed updates org | `plan = 'family'`, `stripe_id` set |
| customer.subscription.deleted resets org | `plan = 'free'`, `stripe_id` cleared |
| invoice.payment_failed logs but no DB change | No org update |
| Unknown event returns 200 | Ignored gracefully |

### `apps/web/app/api/stripe/__tests__/portal.test.ts`

| Test | Assertion |
|------|-----------|
| Returns 403 for non-coordinator | Status 403 |
| Returns 400 if org has no stripe_id | Status 400 |
| Returns portal URL | Response has `{ url }` |

**Stripe mocking:** Mock `stripe` module at import level. Mock `stripe.checkout.sessions.create`, `stripe.customers.create`, `stripe.webhooks.constructEvent`, `stripe.billingPortal.sessions.create`.

---

## File Map

| Action | Path |
|--------|------|
| Create | `apps/web/lib/stripe.ts` |
| Create | `apps/web/app/api/stripe/checkout/route.ts` |
| Create | `apps/web/app/api/stripe/webhook/route.ts` |
| Create | `apps/web/app/api/stripe/verify/route.ts` |
| Create | `apps/web/app/api/stripe/portal/route.ts` |
| Create | `apps/web/app/(app)/billing/success/page.tsx` |
| Create | `apps/web/app/(app)/billing/page.tsx` |
| Modify | `apps/web/app/(marketing)/pricing/page.tsx` |
| Modify | `apps/web/app/(app)/dashboard/DashboardClient.tsx` |
| Create | `apps/web/app/api/stripe/__tests__/checkout.test.ts` |
| Create | `apps/web/app/api/stripe/__tests__/webhook.test.ts` |
| Create | `apps/web/app/api/stripe/__tests__/portal.test.ts` |
| Modify | `apps/web/.env.example` |
