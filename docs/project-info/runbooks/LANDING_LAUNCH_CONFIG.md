# Landing-launch config follow-ups (Track E)

Two prod-only blockers from the 2026-04-27 landing-page feedback that **cannot** be fixed in code — they're config / environment / external service. Work through these in order; each step is "do the thing → verify → check off".

Linked from: `docs/plans/landing-page-feedback-wave.md`.

---

## #6 — Supabase auth NetworkError on `/signin`

Symptom: production sign-in page throws NetworkError contacting `ngtkrguzpqkmnzrwjhyg.supabase.co`.

Root cause was the Supabase project being **paused** (free tier auto-pauses after 7 days idle). You unpaused it on 2026-04-28; this checklist confirms it stays healthy and rules out the next-most-likely cause.

### Steps

- [ ] **1. Confirm restoration finished.**
  Open https://supabase.com/dashboard/project/ngtkrguzpqkmnzrwjhyg.
  Top of the page should NOT show a "Project is paused" or "Restoring…" banner.
  If still restoring, wait 1–2 min and refresh.

- [ ] **2. Smoke test signin in prod.**
  Open the production URL (e.g. https://care-log.org/signin) in a private window.
  Try the email-magic-link flow with a throwaway email.
  - If email arrives and signin completes → **#6 closed.** Skip the rest.
  - If you still get NetworkError → continue to step 3.

- [ ] **3. Check Auth → URL Configuration.**
  Supabase Dashboard → Authentication → **URL Configuration**.
  - **Site URL** must be the prod origin (e.g. `https://care-log.org`).
  - **Redirect URLs** allowlist must include:
    - `https://care-log.org/**`
    - any Vercel preview URL pattern you use (e.g. `https://carelog-*.vercel.app/**`)
  Add anything missing → Save → retry signin.

- [ ] **4. Check Vercel env vars (last resort).**
  Vercel → carelog project → Settings → **Environment Variables** (Production tab).
  Confirm both exist and match the Supabase project:
  - `NEXT_PUBLIC_SUPABASE_URL` = `https://ngtkrguzpqkmnzrwjhyg.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon (publishable) key from Supabase → Project Settings → API
  If either is wrong, fix it and **trigger a redeploy** (env-var changes don't auto-deploy).

- [ ] **5. If still broken**, capture and share:
  - The exact error message + stack from the browser console
  - Network tab: the failing request URL + status code
  - Whether the request even leaves the browser (CORS preflight failure looks different from DNS failure)

---

## #8 — Contact form: no confirmation email arrives

Symptom: contact-form submissions on prod return success but no email lands at `hello@care-log.org`.

Code path is healthy (`apps/web/app/api/contact/route.ts:46-54` — sends via Resend, with a graceful no-op if `RESEND_API_KEY` is unset). Almost always one of: env var missing, sender domain unverified, or destination inbox not actually receiving mail.

### Steps

- [ ] **1. Verify `RESEND_API_KEY` is set in Vercel.**
  Vercel → carelog project → Settings → **Environment Variables** (Production tab).
  - Look for `RESEND_API_KEY`.
  - If missing → grab one from https://resend.com/api-keys → add to Vercel → redeploy.
  - If present → continue.

- [ ] **2. Verify the sender domain is verified in Resend.**
  https://resend.com/domains
  - Sender in code is `noreply@care-log.org` (`route.ts:48`).
  - `care-log.org` must show **Verified** (green) in the Resend domains list.
  - If not verified: Resend will show DNS records (SPF, DKIM, often DMARC) to add to your DNS provider. After adding, click "Verify" — propagation can take 5–60 minutes.

- [ ] **3. Verify the destination inbox actually receives mail.**
  Recipient is `hello@care-log.org` (`route.ts:49`).
  - Send a test email from a personal account to `hello@care-log.org`. Does it arrive?
  - If not, the MX records on `care-log.org` aren't routing to a working inbox. Either fix MX or change the recipient to one that works (then update `route.ts:49`).

- [ ] **4. Submit a test form on prod and watch both logs simultaneously.**
  - Open Vercel → carelog → Logs (Functions filter to `/api/contact`).
  - Open Resend → Logs (https://resend.com/logs).
  - Submit the contact form on production.
  - Vercel function log should show a 200. Resend log should show one outbound message with status `delivered`.
  - Possible outcomes:
    - Vercel 200 + Resend `delivered` + nothing in inbox → **inbox / MX problem** (step 3).
    - Vercel 200 + Resend `bounced` or `complained` → **sender domain or recipient problem** (step 2 or 3).
    - Vercel 200 + nothing in Resend → **`RESEND_API_KEY` unset OR import path silently no-op** (step 1; if step 1 is OK, paste the Vercel function log to me and I'll dig).
    - Vercel 4xx/5xx → form is failing earlier; paste the log and I'll dig.

- [ ] **5. If still broken**, capture and share:
  - Vercel function log lines for one submission
  - Resend log entry for the same submission (or "no entry" if missing)
  - Whether `hello@care-log.org` receives mail from any other sender

---

## When both are ✅

- Tell me — I'll mark #6 and #8 closed in the wave tracker.
- The remaining open items in the wave (Tracks A / B / C / D) are code-side and unaffected by these.
