# Carelog — Code Standards

Merged from former `ENTERPRISE_PRINCIPLES.md` and `PATTERNS.md`. These are decisions
made for specific reasons — deviating requires updating this document.

---

## Auth

### Client-side auth (local dev)
```tsx
useEffect(() => {
  const supabase = createClient()
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) { window.location.href = '/signin'; return }
    setUser(user)
  })
}, [])
```

### Server-side auth (production)
```tsx
const supabase = await createServerSupabase()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/signin')
```

The local dev pattern uses `window.location.href` not `router.push()` because the session
needs to be fully written before navigation.

### Auth cookie consistency — local dev
Supabase sets cookie names based on project URL. `http://127.0.0.1:54321` and
`http://localhost:54321` produce different cookie names. Mixing them causes
"Auth session missing" even with a valid cookie. Pick one format and use it everywhere:
- `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
- `emailRedirectTo` in `signInWithOtp`
- `site_url` in `supabase/config.toml`

### Server Actions vs API Routes for Auth
Next.js server actions don't reliably propagate cookie writes to subsequent server
component renders. Use API routes (not server actions) for any operation that must
write cookies and then redirect.

```ts
// WRONG — cookie write may not propagate before redirect
'use server'
export async function verifyOtpAction() {
  await supabase.auth.verifyOtp(...)
  redirect('/dashboard')
}

// RIGHT — API route writes cookie in the same response
export async function POST(request: NextRequest) {
  await supabase.auth.verifyOtp(...)
  return NextResponse.json({ success: true })
  // Client then does window.location.replace('/dashboard')
}
```

### Client vs Server Auth in Local Dev
In local dev, auth is handled client-side. The SSR server client's cookie format
doesn't always match what `@supabase/ssr` expects. Dashboard and protected pages use
`createClient()` (browser) via `useEffect`. Do not "fix" this without verifying
production behavior first.

---

## RLS & Security

### Service role key isolation
`SUPABASE_SERVICE_ROLE_KEY` bypasses ALL Row Level Security.

**Allowed locations:**
- `apps/web/server/supabaseAdmin.server.ts`
- `apps/web/server/repositories/`
- `apps/web/app/api/` routes

**Never:**
- In client components
- In `apps/mobile/`
- In `packages/`
- Prefixed with `NEXT_PUBLIC_`

`supabaseAdmin.server.ts` has a runtime `typeof window` guard that throws if
accidentally imported client-side. Enforce with an ESLint rule.

Used only for: identity vault reads/writes, membership creation during onboarding,
background job processing (Inngest), migration/seed scripts.

### RLS policies must use scalar boolean functions
Postgres RLS policy expressions do not allow set-returning functions. All RLS helper
functions must return `boolean`.

```sql
-- WRONG — SQLSTATE 0A000
CREATE FUNCTION accessible_recipients() RETURNS SETOF uuid ...
CREATE POLICY "..." USING (id IN (accessible_recipients()));

-- RIGHT — scalar boolean
CREATE FUNCTION user_can_access_recipient(p_id uuid) RETURNS boolean ...
CREATE POLICY "..." USING (user_can_access_recipient(id));
```

### Atomic database operations for concurrent actions
Any operation where two users could race (claiming a slot, accepting coverage, consuming
an invite token) must be implemented as a single atomic database function, not as
read-then-write operations in application code.

```sql
CREATE FUNCTION claim_outer_circle_slot(...) RETURNS uuid AS $$
BEGIN
  UPDATE outer_circle_requests
  SET slots_filled = slots_filled + 1
  WHERE id = p_request_id AND slots_filled < slots_total;

  IF NOT FOUND THEN RAISE EXCEPTION 'slot_unavailable'; END IF;
END; $$;
```

---

## Turbopack / JSX

### Never use template literals in JSX props
```tsx
// WRONG — Turbopack rejects
<a href={`/journal/${recipientId}`}>...</a>

// RIGHT — compute first
const url = '/journal/' + recipientId
<a href={url}>...</a>

// ALSO RIGHT — onClick for dynamic navigation
<button onClick={() => { window.location.href = '/journal/' + id }}>
```

### Keep JSX opening tags single-line with dynamic props
```tsx
// WRONG — Turbopack chokes on > on its own line
<a
  href={someUrl}
  className="..."
>

// RIGHT
<a href={someUrl} className="...">
```

When Turbopack gives "unexpected token `>`" or "expected `>`", the culprit is almost
always a multi-line JSX attribute or a template literal in a prop.

### File extensions
- `.tsx` — any file containing JSX
- `.ts` — pure TypeScript (API routes, utilities, repositories, configs)

Using `.ts` for a file with JSX causes a Turbopack parse error (stricter than Webpack).

---

## Form handling

### Read all form values before any await
`e.currentTarget` becomes null after any `await` — React pools synthetic events.

```tsx
async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault()
  const form = e.currentTarget
  const name = (form.elements.namedItem('name') as HTMLInputElement).value
  const email = (form.elements.namedItem('email') as HTMLInputElement).value
  // Now safe to await
  const supabase = createClient()
  const user = await supabase.auth.getUser()
}
```

### No HTML `<form>` with server actions for auth
Use client-side form handlers. Server actions don't reliably propagate session cookies.

---

## Sentry tag convention (TD-176)

Every `Sentry.captureException` call carries a `component` tag for dashboard filtering. Use one of three shapes depending on the call site:

| Surface | Shape | Example |
|---|---|---|
| tRPC procedure | `<routerName>.<procedureName>` | `"memberships.invite"`, `"recipients.updateEmergencyInfo"` |
| API route (`apps/web/app/api/...`) | `api.<resource>.<verb>` | `"api.ocr.confirm"`, `"api.invite.accept"` |
| Inngest function | `inngest.<functionName>` | `"inngest.refillAlert"`, `"inngest.weeklyDigest"` |

The `api.` prefix on API-route tags lets Sentry dashboards distinguish HTTP-handler captures from tRPC-procedure captures at a glance. The `inngest.` prefix does the same for cron/event functions vs request-driven code.

Also include a `path` tag identifying the specific error branch (e.g. `"caller.error"`, `"resend.error"`, `"rpc.fallthrough"`). The path is informational; `component` is the primary dashboard filter.

PHI rule: per [ADR-0001](../../adr/0001-phi-anonymous-uuid-only.md), tags must contain only stable identifiers (component name, path label). Never spread `input`/`patch`/`ctx` into Sentry calls. Never include PHI field names (`name`, `phone`, `dob`, `email`).

## API routes

All API routes in `apps/web/app/api/`:
- Use service role Supabase client (bypasses RLS)
- Validate input manually or via Zod
- Return `NextResponse.json()` — never raw strings
- Export named `GET`, `POST`, etc. — never a default export

```typescript
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.field) {
      return NextResponse.json({ error: 'Missing field' }, { status: 400 })
    }
    const result = await doSomething(body)
    return NextResponse.json({ success: true, data: result })
  } catch (e: any) {
    console.error('[route-name] error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
```

---

## File conventions

### Pages vs components
- Page files (`page.tsx`) should be thin — import and render one client component
- Business logic lives in client components (`DashboardClient.tsx`, `JournalClient.tsx`)
- Required because Next.js 16 server components can't call client component functions
  directly

### Server repositories
`apps/web/server/repositories/` contains the data access layer:
- Server-only (import supabaseAdmin)
- Never imported in client components
- Accept a Supabase client as a parameter (testable)

### Never use `cat >>` for config files
Running `cat >> file << 'EOF'` twice appends duplicate blocks. Always use `cat >`
(overwrite) when creating or updating files via terminal. Use `>>` only when you
explicitly intend to append.

### Heredoc shell escaping
Shell heredocs fail silently or corrupt content with backticks, `$`, certain quote
combinations. For complex files (JSX, TypeScript generics, template literals), create
files in the editor, not via terminal heredoc.

---

## Zod validation

All care_event payloads must be validated before insertion:
```typescript
import { validatePayload } from '@carelog/schemas'
const validatedPayload = validatePayload(eventType, rawPayload)
```

Schemas in `packages/schemas/src/careEvents.ts`. Adding a new event_type requires:
1. Adding the schema to `careEvents.ts`
2. Adding the type to the `event_type` enum in `payloadSchemas`
3. Adding a migration to update the DB enum

---

## Database migrations

### Migrations are ordered and irreversible
Migration files are named with timestamps and applied in order. Never edit a migration
that has been applied to any environment. If a migration has a bug, write a new one.

Naming: `YYYYMMDDHHMMSS_description.sql`

The auth migration must always run after the core schema migration because the
`handle_new_user` trigger references `public.user_profiles`.

### Commands
```bash
supabase db reset  # resets local DB and applies all migrations
supabase test db   # runs pgTAP tests
```

---

## Testing conventions

### Unit tests
- Location: `packages/*/src/__tests__/*.test.ts`
- Framework: Vitest — no database, no network
- Test pure functions and Zod schemas

### RLS tests
- Location: `supabase/tests/*.test.sql`
- Framework: pgTAP (built into Supabase CLI)
- Run: `supabase test db`

### E2E tests
- Location: `e2e/*.spec.ts`
- Framework: Playwright against localhost:3000 + local Supabase
- `clearMailpit()` in beforeEach
- `signIn(page, email)` helper reads OTP from Mailpit API

### What NOT to test
- Snapshot tests of UI components
- That Supabase works
- That Tailwind classes render
- That Next.js routing works
- 100% coverage as a goal

---

## Git conventions

```
feat: description     — new feature
fix: description      — bug fix
test: description     — tests only
refactor: description — refactor without feature change
chore: description    — dependencies, config, tooling
```

---

## Environment management

### Local dev
`.env.local` files are gitignored. Never commit secrets.

### Production
Environment variables set in Vercel dashboard. Never put production keys in any file.

### Key distinction
- `NEXT_PUBLIC_*` — safe for client bundle, visible in browser
- Everything else — server-only
- `SUPABASE_SERVICE_ROLE_KEY` must NEVER be `NEXT_PUBLIC_`
