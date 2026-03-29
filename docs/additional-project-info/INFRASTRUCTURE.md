# Carelog — Infrastructure Decisions

## Why each third-party service was chosen

### Supabase (database + auth + storage)
**Why:** PostgreSQL with batteries included. Row-level security built in.
Auth, storage, and realtime in one platform. Local dev with CLI.
The alternative (raw Postgres + Auth0 + S3 + etc.) adds complexity without
meaningful benefit for a bootstrapped product at this stage.

**Key constraint:** Supabase's HIPAA BAA is available on paid plans.
The identity vault pattern (tokenization of PHI) is designed so that
most data is NOT PHI — only the vault is — reducing the HIPAA surface area.
Sentry, Inngest, and PostHog never see real names because they never
touch the identity vault.

**Local dev:** `supabase start` runs the full stack locally via Docker.
Migrations in `supabase/migrations/`. Tests in `supabase/tests/`.

---

### Vercel (web hosting)
**Why:** Next.js is made by Vercel. Zero-config deployment. Edge network.
Preview deployments on every PR. The alternative (self-hosted, Railway, Render)
adds operational overhead for no meaningful benefit.

**Key integration:** Supabase has a Vercel integration that auto-sets
environment variables. One click to connect the two.

---

### Expo (mobile)
**Why:** React Native with a managed workflow. Same team can write web and
mobile. EAS Build handles the iOS/Android build pipeline without needing Macs
in CI. The alternative (bare React Native, Flutter) requires more native expertise.

**Key decision:** Expo SDK 52 with the new architecture enabled.
The offline queue uses `expo-secure-store` for encrypted persistence.

---

### Inngest (background jobs)
**Why chosen over alternatives:**
- **vs. Vercel Cron:** No retry logic, no observability, no queuing
- **vs. BullMQ/Redis:** Requires self-hosted Redis, more ops overhead
- **vs. Trigger.dev:** Similar, but Inngest has better Next.js integration
- **vs. raw cron:** No reliability, no observability, no retries

**What it's used for:**
- Weekly digest — runs Sunday morning, staggered by `digestMinuteOffset(orgId)`
- Prescription label OCR pipeline — async, retryable
- Refill alerts — nightly scan for `supply_days_remaining <= 7`
- Medication gap detection — flags missed doses

**Idempotency:** All Inngest jobs use Upstash Redis for idempotency keys.
This prevents duplicate sends if a job is retried.
Key pattern: `digest:{orgId}:{week_stamp}`, `refill:{medicationId}:{week_stamp}`

**Not yet wired.** Inngest is in the dependencies but no jobs are implemented yet.

---

### Resend (transactional email)
**Why chosen over alternatives:**
- **vs. SendGrid:** Better developer experience, modern API, better deliverability
- **vs. Postmark:** Similar quality, Resend has better pricing at scale
- **vs. AWS SES:** Too much ops overhead for a bootstrapped product
- **vs. Mailgun:** Legacy API, worse developer experience

**What it's used for:**
- OTP sign-in codes
- Invite emails (with invite link)
- Weekly digest emails
- Refill alerts

**Local dev:** Mailpit captures all emails locally. No real emails sent.
Open `http://127.0.0.1:54324` to see captured emails.

**Not yet wired.** Resend is in the dependencies but the email sending
code is not implemented. Current invite flow logs the URL to console.

---

### Upstash Redis (idempotency + rate limiting)
**Why Upstash vs hosted Redis:**
Upstash is serverless Redis — no persistent connection, pay per request.
In a Vercel serverless environment, persistent Redis connections don't work
well. Upstash is designed for exactly this use case.

**What it's used for:**
- Inngest job idempotency keys
- Future: rate limiting on auth endpoints (OTP requests)

**Not yet wired.**

---

### Stripe (billing)
**Why:** Standard choice for SaaS billing. Stripe Billing handles
subscriptions, invoicing, dunning, and payment method management.

**Pricing model:**
- Family plan: $14/mo or $120/yr (one subscription, whole care team)
- No per-seat pricing
- Future: employer plan (different pricing, TBD)

**Integration point:** `organizations.stripe_id` stores the Stripe customer ID.
`organizations.plan` stores the current plan tier.

**Not yet wired.**

---

### Sentry (error tracking)
**Why:** Industry standard for error tracking. Source maps integration with
Next.js. Session replay for debugging user-reported issues.

**Key design decision:** Sentry never sees real names. The identity vault
tokenization ensures that any error context captured by Sentry contains
only UUIDs, not PHI.

**Not yet wired.**

---

### PostHog (analytics)
**Why chosen over alternatives:**
- **vs. Mixpanel:** Open source, self-hostable if needed, better pricing
- **vs. Amplitude:** Similar capability, PostHog is more developer-friendly
- **vs. Google Analytics:** GA4 is not HIPAA-appropriate

**Key design decision:** PostHog never sees real names. Same as Sentry.
Events are tracked by anonymous user IDs, not emails or names.

**What to track:**
- Sign-up funnel (visit → sign-in → onboarding → first journal entry)
- Feature adoption (who uses reactions, who flags entries)
- Retention (week 1, week 4, week 12)
- Care team size growth

**Not yet wired.**

---

### Whisper + Claude API (Phase 7 — future)
**Why:** Visit recorder feature. Caregiver records a doctor's appointment.
Whisper transcribes. Claude extracts structured data (diagnoses, medications,
follow-up instructions). Creates a care_event with the structured output.

**Not in the roadmap until Phase 7.** The data model supports it
(`ocr_jobs` pattern can be extended for audio jobs) but implementation
is far future.

---

## Infrastructure decisions NOT made (and why)

### Not using GraphQL
tRPC provides end-to-end type safety without a schema language or codegen step.
For a small team building fast, tRPC is the right choice. GraphQL adds
complexity without proportional benefit until the API has many consumers.

### Not using a separate CDN for Supabase Storage
Supabase Storage has built-in CDN. For a bootstrapped product this is sufficient.
If prescription label photos or document vault files become large at scale,
evaluate Cloudflare R2 at that point.

### Not using a message queue (beyond Inngest)
Inngest handles the background job use cases. A separate message queue (SQS, RabbitMQ)
would add operational complexity for no current benefit.

### Not self-hosting anything
Every service is managed. The team has no operational capacity for self-hosting.
The exception would be if HIPAA compliance required self-hosting Sentry or PostHog —
evaluate at that point.

### Not using a separate search service (Algolia, Elasticsearch)
The journal search use case is: full-text search over care_events.payload.text.
PostgreSQL's `pg_trgm` extension (already installed) handles this.
A separate search service is not needed at any foreseeable scale.
