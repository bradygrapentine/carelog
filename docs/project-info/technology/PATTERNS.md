# Carelog — Patterns & Conventions

Read this before writing any new code. These are not preferences — they are
decisions made for specific reasons. Deviating requires updating this document.

## File naming and structure

### Extensions
- `.tsx` — any file containing JSX (components, pages)
- `.ts` — pure TypeScript (API routes, utilities, repositories, configs)
- Using `.ts` for JSX causes a Turbopack parse error (Principle #6)

### Pages vs components
- Page files (`page.tsx`) should be thin — import and render one client component
- Business logic lives in client components (`DashboardClient.tsx`, `JournalClient.tsx`)
- This pattern is required because Next.js 16 server components can't call client
  component functions directly

### API routes
All API routes are in `apps/web/app/api/`. They:
- Use the service role Supabase client (bypasses RLS)
- Validate input manually or via Zod
- Return `NextResponse.json()` always — never return raw strings
- Export named `GET`, `POST`, etc. — never a default export

### Server repositories
`apps/web/server/repositories/` contains the data access layer.
These files:
- Are server-only (import supabaseAdmin)
- Never imported in client components
- Accept a Supabase client as a parameter (testable)

## Auth patterns

### Client-side auth (current, local dev)
```tsx
// In a client component
useEffect(() => {
  const supabase = createClient()
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) { window.location.href = '/signin'; return }
    setUser(user)
    // load data...
  })
}, [])
```

### Server-side auth (production, once deployed)
```tsx
// In a server component (page.tsx)
const supabase = await createServerSupabase()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/signin')
```

The local dev pattern uses `window.location.href` not `router.push()` because
the session needs to be fully written before navigation.

## Navigation

### NEVER use template literals in JSX props (Turbopack Principle #1)
```tsx
// WRONG — Turbopack rejects this
<a href={`/journal/${recipientId}`}>

// RIGHT — compute first
const url = '/journal/' + recipientId
<a href={url}>

// ALSO RIGHT — use button with onClick
<button onClick={() => { window.location.href = '/journal/' + recipientId }}>
```

### NEVER put opening JSX tag `>` on its own line with dynamic props
```tsx
// WRONG — Turbopack chokes on the > on its own line
<a
  href={someUrl}
  className="..."
>

// RIGHT — keep it on one line
<a href={someUrl} className="...">
```

## Form handling

### Read ALL form values before any await
```tsx
async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault()
  // Read values FIRST — e.currentTarget becomes null after await
  const form = e.currentTarget
  const name = (form.elements.namedItem('name') as HTMLInputElement).value
  const email = (form.elements.namedItem('email') as HTMLInputElement).value
  
  // NOW safe to await
  const supabase = createClient()
  const user = await supabase.auth.getUser()
}
```

### No HTML `<form>` with server actions for auth
Use client-side form handlers. Server actions don't reliably propagate
session cookies. Use API routes instead.

## Service role usage

The service role key (`SUPABASE_SERVICE_ROLE_KEY`) bypasses ALL RLS.

**Allowed locations:**
- `apps/web/server/supabaseAdmin.server.ts`
- `apps/web/server/repositories/`
- `apps/web/app/api/` routes

**Never:**
- In client components
- In `apps/mobile/`
- In `packages/`
- Prefixed with `NEXT_PUBLIC_`

The `supabaseAdmin.server.ts` file has a runtime `typeof window` guard that
throws if accidentally imported client-side.

## API route conventions

```typescript
// Standard API route shape
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.field) {
      return NextResponse.json({ error: 'Missing field' }, { status: 400 })
    }
    
    // Do the work
    const result = await doSomething(body)
    
    return NextResponse.json({ success: true, data: result })
  } catch (e: any) {
    console.error('[route-name] error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
```

## Zod validation

All care_event payloads must be validated before insertion:
```typescript
import { validatePayload } from '@carelog/schemas'

// Throws ZodError if invalid — never reaches DB
const validatedPayload = validatePayload(eventType, rawPayload)
```

The Zod schemas are in `packages/schemas/src/careEvents.ts`.
Every event_type has a schema. Adding a new event_type requires:
1. Adding the schema to `careEvents.ts`
2. Adding the type to the `event_type` enum in `payloadSchemas`
3. Adding a migration to update the DB enum

## Database migrations

### Never edit a migration that has already been applied
If a migration has a bug, write a new migration to fix it.

### Naming convention
`YYYYMMDDHHMMSS_description.sql`

### Apply migrations
```bash
supabase db reset  # resets local DB and applies all migrations
```

### Test migrations
```bash
supabase test db   # runs pgTAP tests in supabase/tests/
```

## Testing conventions

### Unit tests
- Location: `packages/*/src/__tests__/*.test.ts`
- Framework: Vitest
- No database, no network
- Test pure functions and Zod schemas

### RLS tests
- Location: `supabase/tests/*.test.sql`
- Framework: pgTAP (built into Supabase CLI)
- Test actual database policies
- Run: `supabase test db`

### E2E tests
- Location: `e2e/*.spec.ts`
- Framework: Playwright
- Run against localhost:3000 + local Supabase
- Use `clearMailpit()` in beforeEach to avoid email conflicts
- Use `signIn(page, email)` helper — reads OTP from Mailpit API

### What NOT to test
- Snapshot tests of UI components
- Testing that Supabase works
- Testing that Tailwind classes render
- Testing Next.js routing
- 100% coverage as a goal

## Git conventions

Commit messages follow this pattern:
```
feat: description     — new feature
fix: description      — bug fix
test: description     — tests only
refactor: description — refactor without feature change
chore: description    — dependencies, config, tooling
```

## Environment management

### Local dev
`.env.local` files are gitignored. Never commit secrets.
Keys are available in `CLAUDE.md` for the local Supabase instance.

### Production
Environment variables set in Vercel dashboard.
Never put production keys in any file.

### Key distinction
`NEXT_PUBLIC_*` — safe for client bundle, will be visible in browser
Everything else — server-only, never accessible client-side

`SUPABASE_SERVICE_ROLE_KEY` must NEVER be `NEXT_PUBLIC_`.
