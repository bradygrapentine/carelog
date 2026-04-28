# Supabase Auth NetworkError Runbook

**Symptom:** Browser sign-in fails with `NetworkError` against `*.supabase.co` (e.g., `ngtkrguzpqkmnzrwjhyg.supabase.co`). Localhost auth works fine.

**Scope:** Production deployment only. Local dev always works because it uses the same Supabase project and env vars are correct.

---

## 1. Verify Environment Variables in Vercel

The production build must have correct `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set.

**Steps:**
1. Open Vercel project settings → **Settings** → **Environment Variables**
2. Confirm `NEXT_PUBLIC_SUPABASE_URL` matches your active Supabase project's API URL (copy from Supabase dashboard → **Settings** → **API**)
3. Confirm `NEXT_PUBLIC_SUPABASE_ANON_KEY` matches the **public anon key** from the same page
4. If either is wrong or points to a different project, update Vercel, then redeploy (production will auto-redeploy or trigger via `vercel deploy --prod`)
5. Wait ~2 min for deployment to finish, then test sign-in again

**Why this fails:**
- Branch environment variables override production defaults. If a staging branch was promoted to production with the wrong credentials, requests go to the wrong Supabase project.
- Copy-paste errors during initial setup (e.g., secret key instead of anon key).

---

## 2. Check Supabase Project Status

Free-tier projects auto-pause after 1 week of inactivity. A paused project rejects auth requests.

**Steps:**
1. Log into Supabase dashboard
2. Select the active project (match the URL from Vercel's `NEXT_PUBLIC_SUPABASE_URL`)
3. Check the banner at the top of the page:
   - If you see **"Your project is paused due to inactivity"**, click **Resume**
   - Resume takes ~30 seconds; the project will be unavailable during that time
4. After resume completes, test sign-in again

**Why this fails:**
- Free projects pause automatically. Paid projects do not.
- Paused projects return `error_description: "Database is suspended"` or similar, manifesting as a network error in the browser.

---

## 3. Read the Failing Fetch in Browser DevTools

Open the browser **Network** tab and attempt to sign in. Look for requests to `supabase.co`:

**CORS preflight failure:**
- Request: **OPTIONS** to `https://ngtkrguzpqkmnzrwjhyg.supabase.co/auth/v1/...`
- Response: **403** or no response
- → Fix: Add your production origin to Supabase **Settings** → **URL Configuration** → **Redirect URLs**

**DNS / connection failure:**
- Request shows **ERR_NAME_NOT_RESOLVED** or **ERR_TIMED_OUT**
- → Likely regional DNS issue or Supabase infrastructure incident. Check [Supabase status page](https://status.supabase.com/). If green, restart your browser and clear cache.

**401 / 403 (unauthorized):**
- Response: **401** or **403** with `error_description: "Invalid API key"`
- → Fix: Anon key in Vercel is wrong or revoked. Rotate the key in Supabase **Settings** → **API** → **Keys & tokens**, copy the new public anon key, update Vercel, redeploy.

**500 (server error):**
- Response: **500**
- → Supabase backend issue. Check [status page](https://status.supabase.com/) and wait, or contact Supabase support if the status is green.

---

## 4. Fix Matrix

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| OPTIONS request **403** | Missing origin in URL config | Supabase **Settings** → **URL Configuration** → add your production URL to **Redirect URLs** |
| env var points to wrong project | Different project credentials in Vercel | Vercel **Environment Variables** → update `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` → redeploy |
| `Database is suspended` error | Free-tier project auto-paused | Supabase dashboard → **Resume** (takes ~30s) |
| `Invalid API key` (401/403) | Anon key rotated or incorrect | Supabase **Settings** → **API** → copy new public key → Vercel env var → redeploy |
| DNS timeout | Regional outage or browser cache | Check [status.supabase.com](https://status.supabase.com/). Restart browser, clear cache. If status is green, contact ISP or Supabase support. |

---

## Quick Checklist

- [ ] Vercel env vars match the **active** Supabase project
- [ ] Supabase project is **not paused**
- [ ] Production origin is listed in Supabase **URL Configuration**
- [ ] Anon key is current (check **Settings** → **API** → **Keys**)
- [ ] Browser DevTools **Network** tab shows the actual request/response (not just a generic error bubble)

---

## Escalation

If the fix matrix doesn't resolve the issue:
1. Take a screenshot of the failing fetch in DevTools (request + response body)
2. Check [Supabase status page](https://status.supabase.com/) — if red, wait
3. If status is green and the fix matrix didn't help, contact Supabase support with the DevTools screenshot
