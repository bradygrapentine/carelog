# Carelog — Local Dev Troubleshooting

Every issue in this document was hit during development and took real time to resolve.
Check here before debugging from scratch.

---

## Supabase issues

### "failed to merge file config: table auth already exists"

**Cause:** The `[auth]` section in `supabase/config.toml` was duplicated by
running an append command (`cat >>`) twice.

**Fix:**
```bash
# Find all [auth] section line numbers
grep -n "\[auth" supabase/config.toml

# Remove duplicate block — keep first occurrence only
# The duplicate is usually at the end of the file
tail -20 supabase/config.toml  # confirm what's there
head -n <last-good-line> supabase/config.toml > tmp && mv tmp supabase/config.toml
```

**Prevention:** Always use `cat >` (overwrite) not `cat >>` (append).
For config files specifically, edit in VS Code rather than via terminal.

---

### "Cannot connect to the Docker daemon"

**Cause:** Docker Desktop is not running.

**Fix:**
```bash
open -a Docker
# Wait for whale icon in menu bar to stop animating (~30-60 seconds)
supabase start
```

**If Docker isn't installed:**
```bash
brew install --cask docker
# Open from Applications, wait for it to start, then:
supabase start
```

---

### "Database error saving new user" on sign-in

**Cause:** The `handle_new_user()` trigger can't find `public.user_profiles` table.
This happens when the auth migration runs before the table exists, or when the
trigger function doesn't have the correct `search_path`.

**Fix:** The trigger must use `SECURITY DEFINER SET search_path = public`:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- REQUIRED
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (NEW.id, split_part(NEW.email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed: %', SQLERRM;
    RETURN NEW;  -- Never fail auth due to profile creation
END;
$$;
```

The `EXCEPTION WHEN OTHERS THEN RETURN NEW` means the trigger never blocks auth,
even if profile creation fails. This is intentional.

**After fixing:** `supabase db reset`

---

### supabase status shows wrong/old keys after restart

**Cause:** Supabase stopped and restarted, keys may differ from `.env.local`.

**Fix:**
```bash
supabase status
# Copy the Publishable and Secret keys to apps/web/.env.local
# Restart the web app after updating .env.local
```

---

### supabase db reset fails with extension errors

**Cause:** Extensions like pgcrypto already exist from a previous run.

**The error:** `NOTICE (42710): extension "pgcrypto" already exists, skipping`

**This is not an error.** NOTICE is informational. The migration continues.
Only lines starting with `ERROR:` are actual failures.

---

### RLS test fails with "relation does not exist"

**Cause:** Running `supabase test db` against a database that hasn't had migrations applied.

**Fix:**
```bash
supabase db reset  # applies all migrations first
supabase test db   # then run tests
```

---

## Auth issues

### PKCE "code verifier not found in storage"

**Cause:** Magic link auth uses PKCE flow. The code verifier is stored in
localStorage when `signInWithOtp` is called, but is gone by the time the
callback fires (different browser context, cleared storage, etc.).

**Fix:** Use OTP code verification instead of magic links for local dev.
The `SignInForm` component sends an OTP code (6 digits) that the user types in,
bypassing the PKCE redirect entirely.

Do NOT try to fix PKCE locally. It works in production.

---

### Session cookie named "sb-127-auth-token" not "sb-localhost-54321-auth-token"

**Cause:** The Supabase cookie name is derived from the project URL.
`http://127.0.0.1:54321` produces `sb-127-auth-token`.
`http://localhost:54321` would produce a different name.

**This is the root cause of all server-side auth failures in local dev.**

`createServerSupabase()` and `@supabase/ssr` expect a specific cookie format
that the local Supabase doesn't produce. `getUser()` returns null even when
the cookie exists and has a valid session.

**The workaround (implemented):** All protected pages use client-side auth
via `createClient().auth.getUser()` in a `useEffect`. This reads from
localStorage where the session is correctly stored.

**Do not attempt to fix this locally.** It resolves automatically when
deployed to Supabase cloud where the cookie format is correct.

---

### OTP verification succeeds but dashboard redirects to signin

**Cause:** `router.push('/dashboard')` navigates before the session cookie is
fully written. The server receives the navigation request before the cookie
is in the response.

**Fix:** Use `window.location.replace('/dashboard')` instead of `router.push()`.
This forces a full page reload which ensures the server sees the fresh cookie.

If still failing: verify the API route (not server action) is being used for
OTP verification. Server actions don't reliably propagate cookie writes.

---

### "Auth session missing" in server component despite valid cookie

**Cause:** See "Session cookie named sb-127-auth-token" above.
The server Supabase client can't read the local cookie format.

**Workaround:** Parse the cookie directly:
```typescript
const authCookie = cookieStore.getAll().find(c =>
  c.name.includes('auth-token') && !c.name.includes('verifier')
)
const parsed = JSON.parse(authCookie.value)
const userEmail = parsed?.user?.email
```

This is not a permanent fix — it's a local dev workaround. See TECH_DEBT.md.

---

## Next.js / Turbopack issues

### "Expected '>', got 'ident'" — JSX parse error

**Cause:** Turbopack (Next.js 16 bundler) rejects template literals in JSX props
and multi-line opening tags where `>` is on its own line.

**Common triggers:**
```tsx
// FAILS — template literal in prop
<a href={`/journal/${id}`}>

// FAILS — > on its own line
<a
  href={url}
  className="..."
>
```

**Fix:**
```tsx
// WORKS — variable computed outside JSX
const url = '/journal/' + id
<a href={url} className="...">

// WORKS — use button with onClick for dynamic navigation
<button onClick={() => { window.location.href = '/journal/' + id }}>
```

---

### "Proxy is missing expected function export name"

**Cause:** Next.js 16 renamed `middleware.ts` to `proxy.ts` AND requires the
exported function to be named `proxy` not `middleware`.

**Fix:**
1. File must be named `proxy.ts` (not `middleware.ts`)
2. Export must be `export async function proxy(request: NextRequest)`
3. Config export `export const config = { matcher: [...] }` stays the same

---

### "Invalid next.config.ts options — turbo at experimental"

**Cause:** Next.js 16 removed the `experimental.turbo` config option.

**Fix:** Remove the experimental block entirely:
```typescript
// next.config.ts
const nextConfig: NextConfig = {}
export default nextConfig
```

---

### File saves in VS Code but Next.js still shows old content

**Cause:** The file wasn't actually saved, or the shell command that created it
didn't write correctly (heredoc escaping issue).

**Fix:**
```bash
# Verify file content
cat apps/web/app/dashboard/page.tsx | head -5

# If wrong, open in VS Code and retype from scratch
code apps/web/app/dashboard/page.tsx
# Cmd+A → Delete → Type fresh (don't paste from terminal)
```

**Prevention:** For complex files with JSX, always create in VS Code.
Never use terminal heredoc for files with JSX, TypeScript generics, or backticks.

---

### Turbopack workspace root warning

```
Warning: Next.js inferred your workspace root, but it may not be correct.
We detected multiple lockfiles...
```

**This warning is cosmetic.** It doesn't affect functionality.
It appears because there's a `pnpm-workspace.yaml` at the monorepo root and
Next.js detects it while running from `apps/web`.

**Fix:** Remove any `turbo` key from `next.config.ts`. Leave config empty:
```typescript
const nextConfig: NextConfig = {}
```

---

## pnpm / Turborepo issues

### "Could not resolve workspaces — Missing packageManager field"

**Cause:** The root `package.json` doesn't declare which package manager to use.

**Fix:**
```bash
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.packageManager = 'pnpm@9.0.0';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"
```

---

### Vitest "Project name is not unique"

**Cause:** Two `vitest.config.ts` files have the same `name` in the test config.

**Fix:** Each package needs a unique name:
```typescript
// packages/schemas/vitest.config.ts
test: { name: 'schemas', ... }

// packages/utils/vitest.config.ts
test: { name: 'utils', ... }  // NOT 'schemas'

// apps/web/vitest.config.ts
test: { name: 'web', ... }
```

---

### "No projects matched the filter"

**Cause:** Running `pnpm add --filter <name>` where `<name>` doesn't match any
package's `name` field in `package.json`.

**Fix:** Check the actual package names:
```bash
cat apps/web/package.json | grep '"name"'
cat packages/schemas/package.json | grep '"name"'
```

For root-level devDependencies use `-w` flag:
```bash
pnpm add -D somepackage -w
```

---

## E2E test issues

### "File not found" from Inbucket/Mailpit API

**Cause:** The local email service is Mailpit (not Inbucket as assumed).
Mailpit's API endpoint is different.

**Correct Mailpit API:**
```bash
# List all messages
GET http://127.0.0.1:54324/api/v1/messages

# Delete all messages
DELETE http://127.0.0.1:54324/api/v1/messages

# Get specific message
GET http://127.0.0.1:54324/api/v1/message/{ID}
```

The OTP code is in the message `Snippet` field:
`"Snippet": "Magic Link Follow this link to login: Log In Alternatively, enter the code: 123456"`

Parse with: `msg.Snippet?.match(/code:\s*(\d{6})/)`

---

### E2E test clicks elements before dashboard loads

**Cause:** The dashboard is client-side rendered. `await page.click('text=...')`
runs before the Supabase data has loaded.

**Fix:** Add `await page.waitForTimeout(2000)` after sign-in before checking
for care team elements. Use `button:has-text("...")` not `text=...` for buttons.

---

### Playwright navigates to Supabase verify URL but fails

**Cause:** Playwright can't navigate to `http://127.0.0.1:54321/auth/v1/verify?...`
because it's not a web page — it's a redirect endpoint that requires cookies
to be set first.

**Fix:** Use the OTP code flow for E2E tests, not magic link navigation.
Read the code from the Mailpit API. See `e2e/helpers.ts`.

---

## Shell/terminal issues

### Heredoc corrupts file content

**Cause:** Shell heredoc (`cat > file << 'EOF'`) fails with files containing
backticks, `$`, JSX `{}`, or certain quote combinations.

**Symptoms:** File is created but content has double braces `{{}}`, missing
characters, or wrong escaping.

**Fix:** Always create complex files in VS Code:
```bash
code apps/web/app/some/file.tsx
# Paste content directly in VS Code
```

For simple config files without special characters, heredoc is fine.

---

### `cat >>` duplicates content

**Cause:** Running `cat >> file << 'EOF'` twice appends the block twice.

**Fix:** Always use `cat >` (overwrite) unless you explicitly intend to append.
If you need to add to an existing file, edit in VS Code.

---

### Python heredoc: `zsh: event not found: user`

**Cause:** zsh interprets `!` in Python string content as a history expansion.

**Fix:** Write Python to a temp file first, then execute:
```bash
cat > /tmp/script.py << 'EOF'
# Python content here
EOF
python3 /tmp/script.py
```
