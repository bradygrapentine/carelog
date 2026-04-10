# Claude Backlog — Before-Launch

Discrete tasks Claude can execute, ordered by priority. Each task references the detailed plan in `2026-04-09-before-launch.md`. Human prerequisite tasks are noted where they gate Claude work.

Tasks marked **[NOW]** can be started immediately with no human prerequisites. Tasks marked **[AFTER: X]** require a human to complete step X first.

---

## Priority 1 — Fix PHI Security Violation [NOW]

**Task B1 — Fix Sentry PII config**

`sendDefaultPii: true` in both Sentry server and edge configs will leak user emails and IPs to Sentry. This must be fixed before any production deployment.

- Fix `apps/web/sentry.server.config.ts` → `sendDefaultPii: false`, `enableLogs: false`, env var DSN
- Fix `apps/web/sentry.edge.config.ts` → same
- Create `apps/web/sentry.client.config.ts` (missing entirely)
- Update `apps/web/next.config.ts` → move org/project to env vars

**Prompt for subagent:**
> Fix the Sentry PHI violation in the Carelog codebase. In `apps/web/sentry.server.config.ts` and `apps/web/sentry.edge.config.ts`, change `sendDefaultPii` from `true` to `false` and `enableLogs` from `true` to `false`. Move the hardcoded DSN to `process.env.NEXT_PUBLIC_SENTRY_DSN`. Create `apps/web/sentry.client.config.ts` with the same safe config. Update `apps/web/next.config.ts` to read org/project from env vars. Run `npx tsc --noEmit` in `apps/web` and confirm 0 errors. Commit as: `fix: disable Sentry PII — sendDefaultPii false, enableLogs false, env var DSN`.

Full task steps: See `2026-04-09-before-launch.md` → Task B1.

---

## Priority 2 — Stripe Billing Implementation [NOW]

These 4 tasks are sequential and can be started immediately (using Stripe test keys from `.env.local` — no live account needed to write and test the code).

**Task D2 — Create `apps/web/lib/stripe.server.ts`**

Simple: Stripe client with window guard and env var check. See plan Task D2.

**Task D3 — DB migration: `org_subscriptions` table**

- Create `supabase/migrations/20260410000001_subscriptions.sql`
- Create `supabase/tests/subscriptions_rls.test.sql`
- Run `supabase migration up` then `supabase test db`

See plan Task D3.

**Task D4 — Stripe webhook handler**

- Create `apps/web/app/api/stripe/webhook/route.ts`
- Create `apps/web/app/api/stripe/webhook/route.test.ts`
- Handle: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

See plan Task D4.

**Task D5 — Billing tRPC router**

- Create `packages/schemas/src/billing.ts`
- Create `apps/web/server/routers/billing.ts` with `getSubscriptionStatus`, `createCheckoutSession`, `createPortalSession`
- Wire into `apps/web/server/trpc/router.ts`

See plan Task D5.

**Task D6 — BillingBanner component**

- Create `apps/web/app/journal/[recipientId]/BillingBanner.tsx`
- Wire into `JournalClient.tsx`
- Soft-gate: banner shown for null/past_due/canceled/unpaid status; no hard block for MVP

See plan Task D6.

---

## Priority 3 — PostHog Provider [AFTER: Human step 5 (PostHog account)]

**Task B3 — Add PostHog analytics**

- Install `posthog-js`
- Create `apps/web/lib/posthog.ts` with PHI-safe config (`autocapture: false`, `person_profiles: 'never'`)
- Create `apps/web/app/PostHogProvider.tsx`
- Add `<PostHogProvider>` inside `<Suspense>` in `apps/web/app/layout.tsx`

See plan Task B3.

---

## Priority 4 — Supabase Cloud Migration [AFTER: Human step 1 (Supabase cloud project)]

**Task A2 — Link + push migrations**

- `supabase link --project-ref <ref>`
- `supabase db push`
- `supabase storage create-bucket care-documents --private`
- `supabase test db` (against cloud)

See plan Task A2.

---

## Priority 5 — Inngest FROM address fix [AFTER: Human step 7 (Resend domain verified)]

**Task C3 — Update weekly digest FROM address**

- Check `apps/web/inngest/functions/weeklyDigest.ts` for `from:` field
- If it reads `onboarding@resend.dev`, update to `notifications@<verified-domain>`
- Commit

See plan Task C3.

---

## Backlog: Error Boundaries

Noted in BUILD_STATUS as a before-launch item: "Error boundaries on all client pages."

This is not in the main plan above because it's lower priority than billing/observability. When ready:

- Add a `GlobalErrorBoundary` client component wrapping each major page
- Sentry's `@sentry/nextjs` provides `Sentry.ErrorBoundary` — use that
- Pages to wrap: `/journal/[recipientId]`, `/invite/[token]`, `/brief/[token]`, `/care/[token]`

---

---

## Mobile Design Consistency Note

The mobile app (Expo) and mobile-web (Next.js at `<768px`) are separate implementations but serve the same caregivers. Both must look identical.

**What's in sync:**
- Color tokens: `constants/tokens.ts` (mobile) mirrors `apps/web/app/globals.css` @theme (web) — same hex values
- Typography: Inter font on both platforms
- Component visual language: cards, role badges, mood indicators use same values
- Nav chrome: slate-900 (`#0f172a`) on both bottom tab bar (native) and sidebar (web desktop) / sheet (web mobile)

**Rule for future changes:** If you change any brand color in `apps/web/app/globals.css`, also update `apps/mobile/constants/tokens.ts`. These files should stay in sync — they are intentionally parallel, not DRY.

---

## Sequencing Summary

```
[NOW]    B1: Fix Sentry PII          (no deps)
[NOW]    D2: stripe.server.ts        (no deps)
[NOW]    D3: DB migration            (no deps, local supabase)
[NOW]    D4: Stripe webhook          (after D2, D3)
[NOW]    D5: Billing tRPC router     (after D4, schemas)
[NOW]    D6: BillingBanner           (after D5)
[HUMAN]  A1: Supabase cloud
[AFTER A1] A2: supabase link + push
[HUMAN]  A3: Vercel project + env vars
[HUMAN]  B2: PostHog account
[AFTER B2] B3: PostHog provider
[HUMAN]  C1: Inngest cloud account
[HUMAN]  C2: Resend account + domain
[AFTER C2] C3: FROM address fix + Inngest register
[HUMAN]  D1: Stripe account + product (keys → Vercel)
```
