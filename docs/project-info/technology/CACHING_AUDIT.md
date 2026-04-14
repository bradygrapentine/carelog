# Next.js Caching Directive Audit

**Generated:** 2026-04-14  
**Command:** `grep -rn 'export const dynamic|revalidate|fetchCache' apps/web/app/`  
**Scope:** All `page.tsx`, `layout.tsx`, `route.ts` files under `apps/web/app/`  
**Note:** This is a report only — no files were modified.

---

## 1. Directives Found

Only **one** file has an explicit caching directive:

| File | Directive | Value | Assessment |
|---|---|---|---|
| `apps/web/app/invite/[token]/page.tsx` | `"use client"` (implicit dynamic via `React.use(params)`) | N/A — client component | **Correct.** Client component; Next.js does not apply static rendering. |

**`grep` for `export const dynamic`, `export const revalidate`, `export const fetchCache` returned zero matches** across the entire `apps/web/app/` directory.

---

## 2. Route Classification

### 2a. Auth-gated / user-specific routes — should be `dynamic = 'force-dynamic'`

These routes call `createServerSupabase()` or `redirect()` server-side, meaning they read cookies/session. Without `export const dynamic = 'force-dynamic'`, Next.js *may* attempt to statically render them at build time (which fails) or serve a stale cached response.

| Route | Classification | Directive Present | Risk |
|---|---|---|---|
| `app/(app)/layout.tsx` | Auth shell — reads session, calls `redirect()` | **None** | Medium — Next.js infers dynamic from `cookies()` call; safe in practice but explicit directive is best practice |
| `app/(app)/dashboard/page.tsx` | Protected — uses `createServerSupabase` | **None** | Medium — same inference caveat |
| `app/(app)/billing/page.tsx` | Protected | **None** | Medium |
| `app/(app)/billing/success/page.tsx` | Protected | **None** | Medium |
| `app/(app)/journal/[recipientId]/page.tsx` | Protected + dynamic segment | **None** | Medium |
| `app/(app)/journal/[recipientId]/entry/[eventId]/page.tsx` | Protected + dynamic segment | **None** | Medium |
| `app/(app)/subscriptions/page.tsx` | Protected | **None** | Medium |
| `app/(app)/team/admin/page.tsx` | Protected | **None** | Medium |
| `app/onboarding/page.tsx` | Auth-dependent | **None** | Medium |
| `app/signin/page.tsx` | Auth page | **None** | Low — no session read, but no caching benefit |
| `app/auth/confirm/page.tsx` | Auth callback | **None** | Low — dynamic by nature |
| `app/invite/[token]/page.tsx` | Client component — `"use client"` + `React.use(params)` | Implicit dynamic | **Correct** — client components are always dynamic |

**Key mitigant:** Next.js App Router automatically opts a route into dynamic rendering when it detects `cookies()`, `headers()`, or `searchParams` usage — which `createServerSupabase()` triggers. So these routes are dynamically rendered in practice even without the explicit directive. The missing directive is a code-clarity issue, not a correctness bug today.

### 2b. API routes — should be `dynamic = 'force-dynamic'`

All `app/api/**/route.ts` files handle authenticated mutations or reads. API routes in Next.js App Router default to dynamic. No explicit directive is needed for correctness, but adding `export const dynamic = 'force-dynamic'` is best practice for clarity and to prevent accidental static caching if the route is ever refactored to remove a dynamic signal.

| Route | Notes |
|---|---|
| `app/api/trpc/[trpc]/route.ts` | All tRPC traffic — must be dynamic |
| `app/api/export/route.ts` | Auth + DB reads — must be dynamic |
| `app/api/stripe/*/route.ts` | Stripe webhooks + session — must be dynamic |
| `app/api/invite/*/route.ts` | Auth-gated — must be dynamic |
| `app/api/members/route.ts` | Auth-gated — must be dynamic |
| All other `app/api/**/route.ts` | Auth-gated — must be dynamic |

**Assessment:** All API routes are correctly dynamic by default. No risk.

### 2c. Marketing / public routes — should be static (no directive, or `revalidate`)

| Route | Classification | Directive Present | Assessment |
|---|---|---|---|
| `app/(marketing)/page.tsx` | Public marketing homepage | **None** | **Correct** — static by default. No session reads. ISR with `revalidate` could improve freshness if content is CMS-driven (not currently). |
| `app/(marketing)/pricing/page.tsx` | Public — static content | **None** | **Correct** — static by default. Consider `export const revalidate = 3600` if pricing data becomes dynamic. |
| `app/(marketing)/about/page.tsx` | Public — static content | **None** | **Correct** |
| `app/(marketing)/privacy/page.tsx` | Public — static content | **None** | **Correct** |
| `app/(marketing)/terms/page.tsx` | Public — static content | **None** | **Correct** |
| `app/(marketing)/contact/page.tsx` | Public — static content | **None** | **Correct** — contact form is client-side; no ISR needed |
| `app/(marketing)/layout.tsx` | Marketing shell — no auth | **None** | **Correct** |

### 2d. Special-purpose public routes

| Route | Classification | Directive Present | Assessment |
|---|---|---|---|
| `app/brief/[shareToken]/page.tsx` | Public care brief (share link) | **None** | Needs review — reads DB by share token. Currently no auth, but must be dynamic (token changes). Consider adding `export const dynamic = 'force-dynamic'`. |
| `app/care/[shareToken]/page.tsx` | Public outer-circle view | **None** | Same as above — must be dynamic. |

---

## 3. Findings & Recommendations

### Finding 1 — Missing `dynamic = 'force-dynamic'` on auth-gated pages (Medium, Code Clarity)

**Affected:** All files under `app/(app)/` and `app/onboarding/`, `app/signin/`, `app/auth/confirm/`

**Risk:** Low in practice — Next.js infers dynamic mode from `cookies()` usage inside `createServerSupabase()`. However, without explicit `export const dynamic = 'force-dynamic'`, the behaviour is implicit and fragile. A future refactor that moves cookie reads out of the component (e.g., into a cached helper) could accidentally produce a stale cached render.

**Recommendation:** Add `export const dynamic = 'force-dynamic'` to `app/(app)/layout.tsx`. This cascades to all child routes in the `(app)` group via Next.js layout inheritance. Individual pages do not need the directive if the layout sets it.

```ts
// app/(app)/layout.tsx
export const dynamic = 'force-dynamic'
```

### Finding 2 — `brief/` and `care/` share-token pages are missing `force-dynamic` (Medium, Correctness Risk)

**Affected:** `app/brief/[shareToken]/page.tsx`, `app/care/[shareToken]/page.tsx`

**Risk:** These pages read live DB data (care brief content by token). If Next.js ever caches a response, a revoked or updated brief could still be served stale.

**Recommendation:** Add `export const dynamic = 'force-dynamic'` to both files.

### Finding 3 — Marketing routes are correctly static (None)

All `app/(marketing)/**` routes have no dynamic data reads and are correctly served as static. No action needed. If pricing data is ever pulled from a CMS, add `export const revalidate = 3600` to `pricing/page.tsx`.

### Finding 4 — API routes are correctly dynamic (None)

Next.js App Router defaults all `route.ts` handlers to dynamic when they use request-dependent logic. No action needed.

---

## 4. Summary Table

| Category | Files | Status | Action |
|---|---|---|---|
| Auth-gated pages `(app)/` | 8 pages + layout | Implicit dynamic (safe) | Add `force-dynamic` to `(app)/layout.tsx` |
| Share-token pages | 2 pages | Missing directive | Add `force-dynamic` to each |
| Marketing pages | 7 pages + layout | Correctly static | None |
| API routes | ~20 routes | Correctly dynamic | None |
| Invite page | 1 | Client component — correct | None |
