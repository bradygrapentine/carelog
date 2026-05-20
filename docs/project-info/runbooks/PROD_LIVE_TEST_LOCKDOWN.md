# Runbook — Prod live-test lockdown (TD-221)

**Audience:** operator (Brady). **When:** once, after the 4 prod test accounts are seeded, to make the production Supabase instance safe for manual live testing with email+password.

**Why this is a runbook, not code:** `supabase/config.toml` governs the **local** stack only. Production auth settings live in the Supabase **dashboard** — the steps below cannot be committed to the repo. Flipping `enable_signup` in `config.toml` would only break local `supabase db reset` seeding, not lock prod (threat-model FIND-004).

Dashboard: https://supabase.com/dashboard/project/&lt;prod-ref&gt; → **Authentication**.

## Steps

### 1. Seed the 4 test accounts (prerequisite)
Run the guarded populate script against prod (it requires explicit env — see its header):
```sh
SEED_PROD_TEST=1 \
SUPABASE_URL=https://<prod-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
SEED_PROD_TEST_CONFIRM_HOST=<prod-ref>.supabase.co \
PROD_TEST_EMAILS=a@x.com,b@x.com,c@x.com,d@x.com \
PROD_TEST_PASSWORD='<≥12-char non-breached password>' \
pnpm seed:prod-test
```
The script asserts the password is ≥12 chars (FIND-001). Choose a password NOT in any known breach corpus (FIND-002 — see step 4).

### 2. Disable new signups (FIND-004)
Authentication → **Sign In / Providers** (or **Settings**) → turn OFF "Allow new users to sign up" (email provider). Only the 4 seeded accounts will then exist; nobody can self-register on the live-test instance. Verify: attempting `signInWithOtp`/signup with a fresh email is rejected.

### 3. Set the production minimum password length ≥12 (FIND-001, prod side)
Authentication → **Policies** (Password settings) → set **Minimum password length = 12** (match `supabase/config.toml`). Optionally set password-strength requirements.

### 4. Enable Leaked Password Protection / HIBP (FIND-002)
Authentication → **Policies** → enable **"Leaked Password Protection"** (checks new/changed passwords against HaveIBeenPwned).
- This is a **Pro-plan** feature. If the project is not on Pro / the toggle is unavailable: record this as an **accepted gap** — the compensating controls are (a) signup is locked (step 2), so no attacker-chosen passwords enter the system, and (b) the 4 accounts use strong, operator-chosen, non-breached passwords (step 1).

### 5. Verify production rate limits are sane (FIND-005 — password brute-force)
Authentication → **Rate Limits**. Confirm **sign-in / sign-up** is at a sane default (~30 per 5 min per IP), NOT the inflated local values (`config.toml` sets `sign_in_sign_ups = 1000` for the E2E suite — that is LOCAL ONLY and must never be mirrored to prod).
- **This is the ONLY brute-force protection on the password path:** TD-221's `signInWithPassword` runs client-side (parity with the OTP form, which also calls `verifyOtp` client-side and does not pass through the app-layer `rateLimit.ts` wrapper). So GoTrue's dashboard rate limit must be confirmed live.

### 6. Smoke-verify both auth methods
- `signInWithPassword` works for one seeded account → lands on `/dashboard`.
- `signInWithOtp` still works for a real family flow (OTP was NOT removed).

## Cross-links
- Code: `apps/web/app/signin/SignInForm.tsx` (the coexisting password method).
- Seed: `scripts/seed-prod-test-accounts.mjs`.
- Threat model: `.claude/state/owasp-threat-td-221.md`.
- See also `DEPLOY.md`.
