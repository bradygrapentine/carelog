# Supabase env drift — Vercel fix runbook

When production sign-in breaks with browser console showing
`CORS request did not succeed` + `Status code: (null)` against a
`*.supabase.co` host, the project URL or anon key in Vercel has drifted
from the live Supabase project. This runbook is the recovery procedure.

## Smoking-gun signals

- Browser console: `Cross-Origin Request Blocked … Status code: (null)`
- `curl https://<ref>.supabase.co/auth/v1/health` returns
  `Could not resolve host` (DNS failure, not 404)
- `vercel env ls production` shows `NEXT_PUBLIC_SUPABASE_URL` set
  significantly earlier than `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
  `SUPABASE_PUBLISHABLE_KEY` (mismatched rotation timestamps)
- Pulled env file shows `NEXT_PUBLIC_SUPABASE_ANON_KEY=""`

## Fix

### 1. Get the right values from Supabase

Supabase dashboard → your project → Project Settings → API. Copy:

- **Project URL** — `https://<project-ref>.supabase.co`
- **Project API keys → `anon` `public`** — the JWT-format key
  (starts with `eyJ`, NOT `sb_publishable_*`)
- **Project API keys → `service_role` `secret`** — only if rotating
  the secret too; otherwise leave alone

The app code currently reads the legacy `*_ANON_KEY` variables. The new
`sb_publishable_*` format keys are NOT a drop-in replacement until the
client code is updated to read `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

### 2. Update Vercel production env

```sh
# Remove the stale ones first (vercel CLI prompts to confirm)
vercel env rm NEXT_PUBLIC_SUPABASE_URL production
vercel env rm SUPABASE_URL production
vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env rm SUPABASE_ANON_KEY production

# Then add the fresh values. `vercel env add` prompts for the value
# interactively — paste the key when asked. Repeat for each var.
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_ANON_KEY production
```

Repeat for the `preview` environment if you want preview URLs working.
Mirror to `development` only if local devs want to point at production
Supabase (usually no — dev uses `supabase start` locally).

### 3. Trigger a redeploy

Env changes do NOT auto-redeploy. Either:

```sh
vercel --prod        # redeploy current main from CLI
# OR push an empty commit to main
git commit --allow-empty -m "chore: redeploy to pick up env" && git push
```

### 4. Verify

```sh
# DNS resolves?
curl -sS -o /dev/null -w "%{http_code}\n" \
  https://<new-ref>.supabase.co/auth/v1/health

# App can reach it?
# — open https://care-log.org/signin in a fresh incognito window
# — submit your email, check that the OTP code lands in your inbox
# — paste the code, confirm redirect to /dashboard
```

If the OTP still fails, check Supabase dashboard → Authentication →
URL Configuration → Site URL is `https://care-log.org` and the
Additional Redirect URLs include `https://care-log.org/auth/callback`.

## Why this happens

Supabase rolled out the new `sb_publishable_*` / `sb_secret_*` key
format. Rotating to the new format is opt-in per project. If you rotate
keys (which generates new ones in BOTH formats), Vercel only updates the
specific var name you push — the legacy `*_ANON_KEY` var keeps the OLD
value unless explicitly updated. Combine that with the URL never being
re-set after a project recreate, and the deployed app sends
`apikey: <stale-or-empty>` to a host that no longer resolves.

## Prevention

Filed as a follow-up: add a boot-time guard in `apps/web/lib/supabase.ts`
that throws if `NEXT_PUBLIC_SUPABASE_URL` is empty or
`NEXT_PUBLIC_SUPABASE_ANON_KEY` is empty. Fail-fast at request time
beats silent CORS errors. Track in BACKLOG.md as a TD row.
