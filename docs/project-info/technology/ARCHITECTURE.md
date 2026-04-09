# Carelog — Architecture

## Monorepo structure

```
carelog/
├── apps/
│   ├── web/                          ← Next.js 16 App Router
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── journal/route.ts      ← GET + POST care events
│   │   │   │   ├── invite/route.ts       ← POST create invite
│   │   │   │   ├── invite/[token]/route.ts      ← GET lookup invite
│   │   │   │   ├── invite/[token]/accept/route.ts ← POST accept invite
│   │   │   │   └── onboarding/create/route.ts   ← POST create org+team
│   │   │   ├── auth/callback/route.ts    ← auth callback handler
│   │   │   ├── auth/confirm/page.tsx     ← client-side auth confirm
│   │   │   ├── dashboard/               ← care teams list (client-side auth)
│   │   │   ├── invite/[token]/          ← accept invite UI page
│   │   │   ├── journal/[recipientId]/   ← care journal
│   │   │   ├── onboarding/              ← create first care team
│   │   │   └── signin/                  ← OTP sign-in
│   │   ├── server/
│   │   │   ├── supabaseAdmin.server.ts  ← service role client (server-only)
│   │   │   ├── repositories/            ← data access layer
│   │   │   └── trpc/                    ← tRPC router
│   │   ├── lib/
│   │   │   ├── supabase.ts              ← browser client
│   │   │   └── supabaseServer.ts        ← server component client
│   │   ├── components/providers/
│   │   │   └── TrpcProvider.tsx
│   │   └── proxy.ts                     ← Next.js 16 proxy (replaces middleware)
│   └── mobile/                          ← Expo SDK 52
│       ├── store/offlineQueue.ts        ← SecureStore persistence
│       └── hooks/useOfflineWrite.ts     ← offline-first write hook
├── packages/
│   ├── schemas/src/
│   │   ├── careEvents.ts               ← Zod schemas for all event types
│   │   ├── invites.ts
│   │   └── organizations.ts
│   ├── types/src/index.ts              ← shared TypeScript interfaces
│   └── utils/src/index.ts              ← digestMinuteOffset, stamps, helpers
├── supabase/
│   ├── migrations/
│   │   ├── 20260327234330_core_schema.sql
│   │   ├── 20260328000200_auth_config.sql
│   │   ├── 20260401000000_nullable_pending_membership_user_id.sql
│   │   ├── 20260407000000_atomic_invite_accept.sql
│   │   ├── 20260408000000_shifts_enum_extend.sql
│   │   ├── 20260408000001_shifts_schema_align.sql
│   │   └── 20260409000000_coverage_windows_extend.sql
│   └── tests/
│       └── rls_policies.test.sql
├── e2e/
│   ├── helpers.ts                      ← signIn(), clearMailpit()
│   ├── auth.spec.ts
│   └── journal.spec.ts
├── CLAUDE.md                           ← start here
├── ARCHITECTURE.md                     ← this file
├── BUILD_STATUS.md
├── TECH_DEBT.md
└── ENTERPRISE_PRINCIPLES.md
```

## Database schema — 16 tables

### Core tenancy
- **organizations** — tenancy anchor, every other object has org_id
- **memberships** — user ↔ org ↔ role. recipient_id nullable (null = org-wide coordinator)
- **invite_tokens** — 32-byte hex, 48hr expiry, single-use, email-scoped

### PHI boundary
- **identity_vault** — real names, DOB, contact info. Service role ONLY. Never anon/authenticated.
- **care_recipients** — tokenized. identity_token links to vault. No real names here.
- **display_names** — server-populated 24hr cache. Prevents repeated vault lookups.
- **user_profiles** — extends auth.users. Created by trigger on signup.

### Event log
- **care_events** — universal log. Every action is a care event.
  - `entry_kind`: 'human' (journal entries) | 'system' (medication logged, shift done)
  - `event_type`: journal | medication | shift | appointment | symptom | task | expense | handoff
  - `payload`: jsonb validated by Zod schema per event_type
  - `missed`: generated column from payload.missed

### Medical
- **medications** — normalized catalog. NOT stored in care_events payload.
- **medication_schedules** — recurring schedule per medication. Decoupled from event log.
- **ocr_jobs** — async prescription label scan pipeline. pending→processing→needs_review→confirmed

### Scheduling
- **shifts** — shift assignments with status lifecycle
- **coverage_windows** — explicit expected care periods for gap detection

### Community
- **journal_reactions** — heart/thinking_of_you/strong/grateful. One per user per entry.
- **outer_circle_requests** — volunteer board. Semi-public. No RLS — share_token is credential.
- **outer_circle_claims** — slot claims. No account required.
- **care_briefs** — shareable point-in-time snapshots. De-tokenized at creation.

## RLS design

All policies use scalar boolean functions — NOT set-returning functions.

```sql
-- CORRECT — scalar boolean
CREATE FUNCTION user_can_access_recipient(p_id uuid) RETURNS boolean ...
CREATE POLICY "..." USING (user_can_access_recipient(id));

-- WRONG — set-returning function fails in RLS
CREATE FUNCTION accessible_recipients() RETURNS SETOF uuid ...
CREATE POLICY "..." USING (id IN (accessible_recipients())); -- ERROR 0A000
```

Helper functions:
- `user_can_access_recipient(uuid)` — can user access this recipient?
- `user_is_coordinator_for(uuid)` — is user coordinator for this recipient's org?
- `user_in_org(uuid)` — is user an active member of this org?
- `user_is_org_coordinator(uuid)` — is user coordinator in this org?

Special cases:
- `identity_vault` — service_role ONLY. Always returns 0 rows for anon/authenticated.
- `outer_circle_requests` — open read, token enforced in API layer
- `care_briefs` — open read, token enforced in API layer

## tRPC router

```
appRouter
├── careEvents
│   ├── timeline (query) — paginated event log for a recipient
│   ├── insert (mutation) — validated insert via Zod schema
│   ├── flagged (query) — flagged entries for doctor export
│   └── insertIdempotent (mutation) — for mobile offline queue flush
├── organizations
│   ├── list (query) — orgs for current user
│   ├── get (query) — single org
│   └── create (mutation) — creates org + vault entry + recipient + membership
└── memberships
    ├── list (query) — members of an org
    ├── invite (mutation) — creates membership + invite token
    └── accept (mutation) — validates + consumes token + activates membership
```

All procedures use `protectedProcedure` which requires `ctx.user` to exist.

## Auth flow

1. User enters email → `supabase.auth.signInWithOtp({ email })` (browser client)
2. Mailpit receives email with 6-digit OTP code
3. User enters code → `POST /api/auth/verify` (API route, not server action)
4. API route calls `supabase.auth.verifyOtp()` server-side → sets session cookie
5. Client redirects to `/dashboard` via `window.location.replace()`

Why API route not server action: server actions don't reliably propagate cookie
writes to subsequent renders. See ENTERPRISE_PRINCIPLES.md #3.

## Key design decisions

### Medications are normalized, not jsonb blobs
The medications table is separate from care_events. This enables:
- Prescription label scanning → structured rows
- Refill alerts via simple column query (not jsonb scan)
- Gap detection on the schedule

### Outer circle is intentionally not RLS-protected
The volunteer board is semi-public. Anyone with the share_token can claim a slot
without a platform account. The token IS the access control. The `claim_outer_circle_slot()`
function is atomic — prevents double-booking via UPDATE WHERE slots_filled < slots_total.

### Care briefs de-tokenize at creation
The identity vault is accessed ONCE when a care brief is generated. The snapshot
is stored as jsonb and can be shared via URL without any vault access at view time.
Revoking sets `revoked=true` — the share_token immediately returns 404.

### Display names cache
Every timeline render previously required a vault lookup per recipient.
The `display_names` table caches (recipient_id → full_name) with 24hr TTL.
Cache miss → vault read + cache write. Service role writes, RLS-scoped reads.

## Design Rationale

### Identity vault pattern
Real names, DOB, and contact info live in `identity_vault` only — service role ONLY, anon/authenticated always return zero rows. This keeps PHI out of logs, error reports (Sentry), analytics (PostHog), and background jobs (Inngest). `care_recipients.identity_token` → UUID mapping to `identity_vault.token`. The `display_names` table is a 24hr read-through cache to avoid repeated vault reads.

**You cannot:** SELECT real names from care_recipients (they're not there), display names in a client component without a server-side resolution step, or log recipient names to any external service.

### care_events universal log
Every action is a care_event row — journal entries, medication logs, shifts, expenses. A single longitudinal record enables full history export, weekly digest, doctor export, and burnout analysis.

`entry_kind` distinction is UX-critical: `'human'` entries are displayed prominently; `'system'` entries compactly. Without it, system noise drowns human content (learned from CaringBridge analysis).

`payload` is jsonb validated by Zod per `event_type` before insert — never reaches the DB invalid. The `missed` generated column (`(payload->>'missed')::boolean STORED`) enables fast "missed medications this week" queries without jsonb operators.

### Why medications are NOT in care_events payload
Original design used jsonb blobs. Changed because: (1) "days of Lisinopril remaining" requires parsing jsonb not querying a column, (2) refill alerts need `WHERE supply_days_remaining <= 7`, (3) OCR pipeline needs structured target, (4) gap detection needs clean data. care_events still records THAT a medication was given/missed, referencing by medication ID.

### Why recipient_id on memberships is nullable
`NULL` = org-wide role (coordinator). Value = recipient-scoped role (aide assigned to specific client). Enables the agency model: agency = one org, each client family = one recipient, aides scoped per recipient, coordinator sees all. Without nullable recipient_id, agencies would need a separate org per client.

### Outer circle design
`outer_circle_requests` has RLS enabled but policy is `USING (true)` — intentional open read. The share_token IS the access control. The `claim_outer_circle_slot()` function is atomic: one UPDATE wins, the second finds the WHERE clause fails and gets `slot_unavailable`. No double-booking possible.

### care_briefs snapshot model
Not a live view — vault is accessed ONCE at creation, resolved data stored as jsonb. Care brief URLs are shared outside the platform (doctors, facilities) without platform accounts. A live view would require service-role credentials on a public endpoint. Revoke = set `revoked=true` → URL immediately returns 404. Staleness is intentional — it's a document, not a live feed.

### RLS scalar boolean functions
Postgres RLS cannot call set-returning functions (`SETOF uuid`). All helper functions return `boolean`. They are `SECURITY DEFINER` — run as postgres, allowing joins against tables the calling user can't directly read. Security boundary enforced inside the function.

### Index strategy
**care_events:** `(recipient_id, occurred_at DESC)`, `(org_id, event_type)`, `(actor_id, occurred_at DESC)`, `(recipient_id, event_type, occurred_at DESC)`, `(recipient_id, missed) WHERE missed = true` (partial)

**memberships:** `(user_id, org_id, recipient_id) WHERE accepted_at IS NOT NULL` — most critical index in the database. Every RLS policy function joins against memberships; without this index every RLS check is a table scan.

Many indexes use `WHERE active = true` or `WHERE accepted_at IS NOT NULL` partial filters to stay small and fast.
