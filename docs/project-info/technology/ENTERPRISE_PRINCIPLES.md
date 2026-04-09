# Enterprise Principles — Carelog

A living document of coding practices and principles discovered during development.
These apply to any engineer extending this codebase.

---

## 1. Turbopack JSX Parsing Rules

**Problem:** Turbopack (Next.js 16's bundler) has stricter JSX parsing than Webpack.
It chokes on certain patterns that work fine in standard React:

- Multi-line JSX opening tags where `>` appears on its own line
- Template literals (backticks) inside JSX props: `` href={`/path/${id}`} ``
- JSX props with complex expressions spanning multiple lines

**Principles:**
- Never use template literals in JSX props. Compute URLs as variables before the JSX block.
- Keep JSX opening tags on a single line when they have dynamic props.
- When Turbopack gives "unexpected token `>`" or "expected `>`", the culprit is
  almost always a multi-line JSX attribute or a template literal in a prop.
- Prefer `onClick={() => { window.location.href = '/path/' + id }}` over `<a href={...}>` 
  when the href is dynamic and Turbopack is fighting you.

```tsx
// WRONG — Turbopack will reject this
<a href={`/journal/${recipientId}`}>...</a>

// WRONG — Turbopack may reject multi-line opening tags with dynamic props
<a
  href={someUrl}
  className="..."
>

// RIGHT — compute first, use variable in JSX
const url = '/journal/' + recipientId
<a href={url} className="...">

// RIGHT — use onClick for dynamic navigation
<button onClick={() => { window.location.href = '/journal/' + id }}>
```

---

## 2. Auth Cookie Consistency — Local Dev

**Problem:** Supabase sets cookie names based on the project URL.
`http://127.0.0.1:54321` and `http://localhost:54321` produce different cookie names.
Mixing them causes "Auth session missing" even when a valid cookie exists.

**Principle:** Pick one URL format and use it everywhere, consistently:
- `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
- `emailRedirectTo` in `signInWithOtp`
- `site_url` in `supabase/config.toml`

In local dev the cookie name will be `sb-127-auth-token` or `sb-localhost-54321-auth-token`
depending on which URL you use. Never mix them.

---

## 3. Server Actions vs API Routes for Auth

**Problem:** Next.js server actions do not reliably propagate cookie writes to
subsequent server component renders. Verifying an OTP in a server action and then
calling `redirect()` results in the session cookie not being visible to the next page.

**Principle:** Use API routes (not server actions) for any operation that must
write cookies and then redirect. Server actions are appropriate for mutations
that don't depend on cookie propagation timing.

```ts
// WRONG for auth — cookie write may not propagate before redirect
'use server'
export async function verifyOtpAction() {
  await supabase.auth.verifyOtp(...)
  redirect('/dashboard') // session cookie may not be visible yet
}

// RIGHT — API route writes cookie in the same response
export async function POST(request: NextRequest) {
  await supabase.auth.verifyOtp(...)
  return NextResponse.json({ success: true })
  // Client then does window.location.replace('/dashboard')
}
```

---

## 4. Client-Side vs Server-Side Auth in Local Dev

**Problem:** Supabase local dev stores sessions differently than production.
The browser client stores sessions in localStorage and a cookie. The SSR server
client reads from cookies only. In local dev the cookie format doesn't always
match what `@supabase/ssr` expects, causing `getUser()` to return null even
when the user is signed in.

**Principle:** In this codebase, auth is handled client-side during local development.
Dashboard and protected pages use `createClient()` (browser client) via `useEffect`
to check auth, not `createServerSupabase()` in server components.

This is a deliberate local dev workaround. In production, Supabase sets cookies
correctly and server-side auth works as expected. Do not "fix" this pattern
without first verifying production behavior.

---

## 5. Form Values Must Be Read Before Async Calls

**Problem:** In React, `e.currentTarget` becomes null after any `await` call
because React pools synthetic events and nullifies them asynchronously.

**Principle:** Always read all form values synchronously at the top of the handler,
before any `await`. Store them in local variables.

```tsx
// WRONG — form is null after the first await
async function handleSubmit(e) {
  const supabase = createClient()
  const user = await supabase.auth.getUser() // <-- form becomes null here
  const name = e.currentTarget.elements.namedItem('name').value // CRASH
}

// RIGHT — read values first, then do async work
async function handleSubmit(e) {
  const form = e.currentTarget
  const name = (form.elements.namedItem('name') as HTMLInputElement).value
  const email = (form.elements.namedItem('email') as HTMLInputElement).value
  // Now safe to await
  const supabase = createClient()
  const user = await supabase.auth.getUser()
}
```

---

## 6. File Extension Must Match Content

**Problem:** Turbopack requires `.tsx` for files containing JSX, and `.ts` for
files that are pure TypeScript. Using `.ts` for a file with JSX causes a parse
error. This is stricter than Webpack which often allowed `.ts` files with JSX.

**Principle:** Any file that returns JSX or contains JSX syntax must use `.tsx`.
Server-only files (repositories, utilities, API routes without JSX) use `.ts`.

---

## 7. Never Use `cat >>` for Config Files

**Problem:** Running `cat >> file << 'EOF'` twice appends duplicate blocks.
This caused duplicate `[auth]` sections in `supabase/config.toml` which
broke `supabase start` and `supabase db reset`.

**Principle:** Always use `cat >` (overwrite) when creating or updating files
via the terminal. Use `>>` (append) only when you explicitly intend to append
and are certain the command will not be run twice.

When in doubt, open the file in VS Code and edit it directly.

---

## 8. Heredoc Shell Escaping

**Problem:** Shell heredocs (`cat > file << 'EOF'`) fail silently or corrupt
content when the file contains characters that the shell interprets:
backticks, `$`, certain quote combinations.

**Principle:** For complex files with JSX, TypeScript generics, or template
literals, always create files in VS Code rather than via terminal heredoc.
Use terminal heredocs only for simple config files with no special characters.

When a file must be created via terminal, use Python's file writing instead:
```bash
python3 << 'EOF'
with open('path/to/file.tsx', 'w') as f:
    f.write("""content here""")
EOF
```

---

## 9. RLS Policies Must Use Scalar Boolean Functions

**Problem:** Postgres RLS policy expressions do not allow set-returning functions
(functions that return `SETOF uuid` or similar). Policies like:
`USING (id IN (accessible_recipients()))` fail with SQLSTATE 0A000.

**Principle:** All RLS helper functions must return `boolean`, not `SETOF uuid`.
Use `EXISTS` subqueries inside scalar functions.

```sql
-- WRONG — set-returning function in policy
CREATE FUNCTION accessible_recipients() RETURNS SETOF uuid ...
CREATE POLICY "..." USING (id IN (accessible_recipients())); -- ERROR

-- RIGHT — scalar boolean function
CREATE FUNCTION user_can_access_recipient(p_id uuid) RETURNS boolean ...
CREATE POLICY "..." USING (user_can_access_recipient(id)); -- OK
```

---

## 10. Service Role Key Isolation

**Principle:** The Supabase service role key bypasses ALL Row Level Security.
It must never appear in client-side code, never be prefixed with `NEXT_PUBLIC_`,
and never be imported outside of `server/` or `app/api/` directories.

Enforce this with an ESLint rule on `supabaseAdmin.server.ts` imports.
Add a runtime window guard in the file itself as a second layer of protection.

The service role key is used only for:
- Identity vault reads/writes
- Membership creation during onboarding
- Background job processing (Inngest)
- Migration and seeding scripts

---

## 11. Atomic Database Operations for Concurrent Actions

**Principle:** Any operation where two users could race (claiming a volunteer slot,
accepting a coverage request, consuming an invite token) must be implemented as
a single atomic database function, not as separate read-then-write operations in
application code.

```sql
-- RIGHT — atomic slot claim prevents double-booking
CREATE FUNCTION claim_outer_circle_slot(...) RETURNS uuid AS $$
BEGIN
  UPDATE outer_circle_requests
  SET slots_filled = slots_filled + 1
  WHERE id = p_request_id AND slots_filled < slots_total;
  
  IF NOT FOUND THEN RAISE EXCEPTION 'slot_unavailable'; END IF;
  -- insert claim...
END; $$;
```

---

## 12. Migrations Are Ordered and Irreversible

**Principle:** Migration files are named with timestamps and applied in order.
Never edit a migration that has already been applied to any environment.
If a migration has a bug, write a new migration to fix it.

Migration naming convention: `YYYYMMDDHHMMSS_description.sql`

The auth migration must always run after the core schema migration because
the `handle_new_user` trigger references `public.user_profiles` which is
created in the auth migration.
