# Carelog — System Overview

## Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER  (React client components)                             │
│                                                                 │
│  SignInForm    DashboardClient    JournalClient    InvitePage   │
│                                                                 │
│  Supabase client: createClient()  ← browser-only, anon key     │
│  Auth stored in: localStorage + cookie (sb-127-auth-token)     │
└────────────────────────┬────────────────────────────────────────┘
                         │  HTTP (fetch / tRPC)
┌────────────────────────▼────────────────────────────────────────┐
│  SERVER  (Next.js App Router — API routes + server components)  │
│                                                                 │
│  /api/journal     /api/invite      /api/onboarding/create       │
│  /api/invite/[token]               /api/invite/[token]/accept   │
│                                                                 │
│  Server client: createServerSupabase()  ← reads session cookie  │
│  Admin client:  supabaseAdmin           ← service role, bypasses RLS │
│                                                                 │
│  Repositories (data access layer — server/ only):              │
│    organizationsRepository   identityRepository                 │
│    careEventsRepository      membershipsRepository              │
└────────────────────────┬────────────────────────────────────────┘
                         │  Supabase JS SDK
┌────────────────────────▼────────────────────────────────────────┐
│  SUPABASE  (PostgreSQL + Auth + Storage)                        │
│                                                                 │
│  ┌─────────────────────────────────────────────┐               │
│  │  PHI BOUNDARY — service_role ONLY           │               │
│  │  identity_vault  (real names, DOB, contact) │               │
│  └─────────────────────────────────────────────┘               │
│                                                                 │
│  organizations    care_recipients    memberships                │
│  care_events      display_names      invite_tokens              │
│  medications      medication_schedules   shifts                 │
│  ocr_jobs         coverage_windows   journal_reactions          │
│  outer_circle_requests / claims      care_briefs                │
│  user_profiles    (auth.users — managed by Supabase Auth)       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  SHARED PACKAGES  (used by both web and mobile)                 │
│                                                                 │
│  @carelog/types    — TypeScript interfaces and union types      │
│  @carelog/schemas  — Zod schemas + validatePayload()            │
│  @carelog/utils    — digestMinuteOffset, stamps, tokens         │
└─────────────────────────────────────────────────────────────────┘
```

## Which Supabase Client to Use

| Location | Client | Key Used | RLS Active? |
|---|---|---|---|
| Client components (`'use client'`) | `createClient()` | anon key | Yes |
| Server components / middleware | `createServerSupabase()` | anon key | Yes |
| API routes and `server/` | `supabaseAdmin` | service role | **No** — bypassed |

`supabaseAdmin` bypasses ALL Row Level Security. It is the only way to read
`identity_vault`. Never import it outside `server/` or `app/api/`.

## Monorepo Layout

```
carelog/
├── apps/
│   ├── web/                    Next.js 16 App Router
│   │   ├── app/                Pages + API routes
│   │   ├── server/             Server-only: admin client + repositories
│   │   └── lib/                Browser + server Supabase client factories
│   └── mobile/                 Expo SDK 52 (offline queue, not yet wired)
├── packages/
│   ├── schemas/                Zod validation schemas
│   ├── types/                  Shared TypeScript interfaces
│   └── utils/                  Pure utility functions
├── supabase/
│   ├── migrations/             Applied in order — never edit applied ones
│   └── tests/                  pgTAP RLS policy tests
└── e2e/                        Playwright tests + Mailpit helpers
```

## Key Design Decisions (Quick Reference)

| Decision | Why |
|---|---|
| Real names only in `identity_vault` | HIPAA-adjacent: keeps PHI out of logs, Sentry, analytics |
| All actions go to `care_events` | Single longitudinal record for history export and digest |
| Medications in separate table | Enables refill alerts, OCR pipeline, gap detection |
| `recipient_id` nullable on memberships | Supports agency model (null = org-wide, value = client-scoped) |
| Outer circle has no effective RLS | Share token IS the access control — no account required |
| RLS uses scalar boolean functions | Postgres disallows set-returning functions in USING clauses |
