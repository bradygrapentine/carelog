# TD-221 — Email+password coexisting auth + locked-down prod live-test env

**Date:** 2026-05-20
**Base SHA:** fc3c679d7979c03e5c2f423878598d785d5b84d5 (origin/main, post TD-220/219 close)
**Source backlog:** TD-221 (P2 — auth surface)
**PRD:** n/a
**Threat model:** `.claude/state/owasp-threat-td-221.md` — selection **INCLUDE ALL** (6 findings → acceptance criteria; FIND-001/002 are High).
**Recommended executor:** /sprint (this run) — single track, `opus-direct` (auth surface + external-touch dashboard step).

## Goal

Add **email+password** as a SECOND, coexisting sign-in method (OTP stays the default for families) so the 4 pre-seeded prod test accounts have a fast deterministic login, and lock the prod instance down for manual live testing. The password method must clear ASVS L1 auth (min length ≥12, generic invalid-cred, no password in logs); the prod lockdown + HIBP breached-password check are **Supabase dashboard operator steps** (config.toml is local-only) captured in a runbook.

## Non-goals

- **Do NOT replace OTP** — passwordless email-OTP stays the primary path for real families.
- **Do NOT flip `enable_signup` in `supabase/config.toml`** — that file is local-only and `supabase db reset` seeding needs signup enabled. Prod lockdown is a dashboard step.
- **Do NOT touch the `[auth.rate_limit]` values in config.toml** — the 1000s are intentional local/E2E settings (TD-73); prod uses dashboard defaults.
- No new server auth route — `signInWithPassword` runs client-side via supabase-js, mirroring the existing `verifyOtp` client call (`SignInForm.tsx:65`). **Trade-off (FIND-005):** the form's OTP path ALREADY bypasses the app-layer `rateLimit.ts` wrapper (that wrapper only guards the `api/auth/verify` route, which the form does not call). So the password path is consistent with OTP — brute-force protection for both is **GoTrue's own rate limiter** (prod dashboard `sign_in_sign_ups`), not an app-layer route. Adding a server route just for password would diverge from the OTP pattern; we explicitly keep parity and rely on GoTrue + locked signup + strong pre-set passwords. The runbook (step 6e) makes the operator verify the prod GoTrue sign-in rate limit is sane.
- No MFA, no password-reset/forgot-password flow (the 4 accounts get pre-set passwords via the seed script; broader self-serve password UX is a future row if families ever want passwords).

## Tracks

### Track 1 — email-password-auth (single track)

**Sources backlog TD-221.**

**FILES ALLOWED** (modify/create):
- `apps/web/app/signin/SignInForm.tsx` — add a "use password instead" toggle + `signInWithPassword` path
- `apps/web/app/signin/__tests__/SignInForm.flow.test.tsx` — password-method tests
- `supabase/config.toml` — `minimum_password_length` 6 → 12 (LOCAL; the same floor is set in prod via the runbook). **Only this one key.**
- `scripts/seed-prod-test-accounts.mjs` — enforce/validate the seeded password meets the ≥12 floor (default `CareSyncTest!123` already 16 chars — add an assertion + comment)
- `docs/project-info/runbooks/PROD_LIVE_TEST_LOCKDOWN.md` — NEW operator runbook (dashboard steps for FIND-001 prod min-len, FIND-002 HIBP, FIND-004 signup lockdown, FIND-005 rate-limit verify)

**FILES OUT OF SCOPE — DO NOT TOUCH:**
- `apps/web/app/api/auth/verify/route.ts` (OTP verify path — unchanged; not used by the client form anyway)
- `supabase/config.toml` `enable_signup` keys (L168/L208/L249) and `[auth.rate_limit]` block — explicitly NOT modified
- `apps/web/lib/supabase.ts`, `proxy.ts`, any RLS/migrations, product runtime outside signin

**Branch:** `feat/td-221-email-password-auth` off base SHA above.

**Model:** `opus-direct` — auth surface (security-sensitive) + external-touch (prod dashboard step can't be delegated); low code-blast (one component + config + doc) but high care. Root Opus implements.

**Implementation steps:**
1. **SignInForm password method** (`SignInForm.tsx`): add a `mode` state (`"otp" | "password"`) with a "Use a password instead" link on the email step (and a "Use a code instead" link back). In password mode, render a password `<input type="password">` (labeled, focus ring, `autoComplete="current-password"`); on submit call `supabase.auth.signInWithPassword({ email: email.toLowerCase().trim(), password })` then `router.replace("/dashboard")` on success. **Never** pass `password` (or email) to `posthog.capture`/`identify` or `console` (FIND-006) — capture only `sign_in_completed` with the UUID, exactly as the OTP path does.
2. **Generic errors** (FIND-003): add `friendlyPasswordError(message)` mirroring `friendlyOtpError` — map rate-limit → "Too many attempts…"; everything else (invalid creds, no-such-user) → ONE generic line ("Email or password is incorrect."). Do NOT branch on user-exists vs wrong-password; do NOT surface raw `error.message`.
3. **Client-side length floor** (FIND-001): disable the submit button until `password.length >= 12`; show inline helper "At least 12 characters". (Server/GoTrue enforces too, but fail friendly.)
4. **config.toml** (FIND-001 local): `minimum_password_length = 6` → `12`. Leave `password_requirements`, `enable_signup`, and `[auth.rate_limit]` untouched.
5. **Seed script** (`seed-prod-test-accounts.mjs`): after reading `password`, assert `password.length >= 12` (fail loud with a clear message if `PROD_TEST_PASSWORD` is set too short). Comment: this enforces the LENGTH floor only (FIND-001) — it does NOT validate against HIBP (FIND-002, a dashboard-side check); the operator is responsible for choosing non-breached passwords for the 4 accounts.
6. **Operator runbook** (`PROD_LIVE_TEST_LOCKDOWN.md`): document the dashboard-only steps — (a) FIND-004: Auth → Sign In/Providers → disable new email signups so only the 4 seeded accounts exist; (b) FIND-001 prod: set min password length ≥12 in Auth policies; (c) FIND-002: enable "Leaked Password Protection" (HIBP) — note it's a Pro-plan toggle; if unavailable, record the compensating control (signup locked + strong pre-set passwords) as an accepted gap; (d) confirm prod rate limits stay at sane dashboard defaults (NOT the local 1000s); (e) **FIND-005 (password brute-force):** since password sign-in is client-side (parity with OTP — no app-layer route), explicitly verify the prod GoTrue `sign_in_sign_ups` rate limit is at a sane default (~30/5min) — this is the ONLY brute-force protection on the password path, so it must be confirmed live. Cross-link from `DEPLOY.md`.
7. Run `cd apps/web && npx vitest run app/signin && npx tsc --noEmit && npx eslint --quiet app/signin/SignInForm.tsx`.

**Acceptance (verifiable):**
- `grep -n "signInWithPassword" apps/web/app/signin/SignInForm.tsx` — present (≥1).
- `grep -n "signInWithOtp" apps/web/app/signin/SignInForm.tsx` — STILL present (OTP not removed).
- `grep -E "^minimum_password_length" supabase/config.toml` → `= 12`.
- `grep -nE "sign_in_sign_ups = 1000|token_verifications = 1000" supabase/config.toml` — still present (rate-limit block untouched).
- FIND-006 (no password in logs/analytics), both `-E` dialect: `! grep -nE "posthog\.(capture|identify)\([^)]*password" apps/web/app/signin/SignInForm.tsx` AND `! grep -nE "console\.(log|error|warn|debug|info)\(.*password" apps/web/app/signin/SignInForm.tsx`. (Manual check too: no `password` interpolated into any logged/captured string across the password handler.)
- `grep -n "friendlyPasswordError\|Email or password is incorrect" apps/web/app/signin/SignInForm.tsx` (FIND-003, generic copy).
- `grep -n "length >= 12\|length < 12\|>= 12" apps/web/app/signin/SignInForm.tsx` (FIND-001 client floor).
- `grep -n ">= 12\|length" scripts/seed-prod-test-accounts.mjs` near a password assertion (FIND-001 seed).
- `test -f docs/project-info/runbooks/PROD_LIVE_TEST_LOCKDOWN.md` && `grep -ciE "leaked password|hibp|enable_signup|dashboard" docs/project-info/runbooks/PROD_LIVE_TEST_LOCKDOWN.md` ≥ 3 (FIND-002/004/005 operator steps).
- Tests added: `SignInForm.flow.test.tsx` — (a) toggle to password mode renders the password field; (b) successful password sign-in (mock returns `{data:{user,session},error:null}`) asserts `signInWithPassword` called AND `posthog.identify(uuid)` fired AND `router.replace("/dashboard")` — proving the session/user drives the redirect (not a bounce); (c) failed password sign-in shows the GENERIC error, asserting the wrong-password and unknown-user paths render IDENTICAL copy (no enumeration oracle); (d) OTP path still works (regression).
- `grep -c "enable_signup = true" supabase/config.toml` == **2** exactly (verified against current file: `[auth]` L168 + `[auth.email]` L208 are true; `[auth.sms]` L249 is false) — proves the lockdown was NOT (mis)applied in local config.
- CI green on PR (vitest + typecheck + lint + the auth E2E shard).

**Risk + mitigations:**
- *Prod lockdown done in config.toml by mistake → breaks local seeding* → explicit FILES-OUT-OF-SCOPE + acceptance grep that `enable_signup=true` is unchanged.
- *Password error oracle (enumeration)* → single generic copy + a test asserting wrong-password ≡ unknown-user output.
- *HIBP unavailable on plan* → runbook records it as accepted gap with compensating control, not a blocker.
- *Password leaked to analytics/logs* → negative-grep acceptance + the UUID-only PHI rule.

## Merge order

Single track — no ordering. Merges to main, then the operator walks `PROD_LIVE_TEST_LOCKDOWN.md` against the prod dashboard (manual, post-merge — NOT part of CI).

## Execution gate

Run `/opus-on-opus docs/plans/2026-05-20-td-221-email-password-auth.md --from-sprint` before dispatch. Verify each of FIND-001..006 maps to an acceptance line (any missed selected finding = must-fix). Apply must-fix.

## Post-merge verification

- `git pull && cd apps/web && npx vitest run app/signin && npx tsc --noEmit` on integrated main.
- Operator: walk `PROD_LIVE_TEST_LOCKDOWN.md` against the Supabase prod dashboard (signup off, min-len ≥12, HIBP on, rate limits sane), then `signInWithPassword` for one seeded account + confirm `signInWithOtp` still works for a real family flow.
- `/post-deploy-watch` if this reaches a prod deploy (note: deploy counter is 11 → not a cadence deploy this sprint).

## Open questions

- The 4 prod test emails + their passwords are operator-supplied at seed time (env: `PROD_TEST_EMAILS`, `PROD_TEST_PASSWORD`) — confirmed not committed. No code dependency; runbook references them by env-var name only.
