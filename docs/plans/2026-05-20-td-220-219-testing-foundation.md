# TD-220 + TD-219 — Testing foundation (E2E session injection + rich seed)

**Date:** 2026-05-20
**Base SHA:** db6bec9 (origin/main, post ON-81 close)
**Source backlog:** TD-220, TD-219 (both P2 — test/dev infra; from the 2026-05-20 seed/auth conversation)
**PRD:** n/a
**Threat model:** TD-219 prod-populate is a service-role prod write — controls folded in as acceptance (see Track 2). TD-220 is test-only.
**Recommended executor:** /sprint — 2 disjoint tracks, executed direct-serially (opus-direct), 2 PRs (TD-220 first).

## Goal

Make the app testable at scale: (1) **TD-220** removes the Mailpit OTP email round-trip from E2E auth — the recurring `getOtpFromMailpit timed out` flake — by minting the OTP through the Supabase admin API instead of an inbox; (2) **TD-219** ships a rich, idempotent local/staging scenario seed plus a guarded script to populate the 4 locked-down prod test accounts, so every panel and the new task/notification flows can be exercised with believable content.

## Non-goals

- No product auth change (that's TD-221 — password). TD-220 keeps the real OTP/cookie flow; it only changes where the OTP comes from in tests.
- No real PHI in any seed — synthetic data only.
- The prod-populate script does NOT run in CI or by default — explicit env-flag, manual invocation only.
- Don't touch `BACKLOG.md`, product runtime code, mobile, or auth product surfaces.

## Tracks

### Track 1 — TD-220: E2E auth via admin-API OTP (drop Mailpit)

**FILES ALLOWED:**
- `e2e/helpers.ts` (replace `getOtpFromMailpit` usage in `signIn`; may keep `getOtpFromMailpit` exported for one coverage spec).
- `e2e/auth.spec.ts` (keep ONE test exercising the real Mailpit OTP path for end-to-end coverage; everything else uses the admin path via `signIn`).
- `e2e/CLAUDE.md` (document the new auth helper).

**FILES OUT OF SCOPE:** product code, other specs' bodies (they call `signIn`/`uniqueEmail` unchanged), `proxy.ts`, supabase config.

**Branch:** `test/td-220-e2e-session-injection` off base SHA.

**Model:** `opus-direct` — test infra, judgment on the auth flow; no prod surface.

**Approach (minimal, keeps the real cookie/auth path):**
- Add a service-role admin client in the E2E helper (local Supabase URL `http://127.0.0.1:54321` + `SUPABASE_SERVICE_ROLE_KEY` from env, with the well-known local default as fallback for `supabase start`).
- New `getOtpViaAdmin(email)`: `admin.auth.admin.generateLink({ type: 'magiclink', email })` → return `data.properties.email_otp`. **No email is sent → no Mailpit.**
- **OTP ordering (opus S1 — avoids the two-OTP race):** `signIn` keeps its UI flow (goto /signin → fill email → click "Continue with email"). The UI's `handleSendOtp` calls `signInWithOtp({ shouldCreateUser: true })`, which (a) creates the user if new and (b) mints its own OTP. Call `getOtpViaAdmin` **AFTER** the `waitFor("Check your email")` confirmation — so the user provably exists (UI send completed) AND the admin-minted OTP is the **most-recent**, which is the one GoTrue honors on verify. Fill that OTP → "Verify code" → /dashboard. (Do NOT mint the admin OTP before the UI send — it would be invalidated by the UI's later send.) No separate `admin.createUser` needed (the UI's `shouldCreateUser:true` handles creation).
- **OTP-type note (opus S2 — don't "fix" this):** the UI verifies with `type: "email"` (`SignInForm.tsx` / `api/auth/verify/route.ts`); `generateLink({type:'magiclink'})` mints an `email_otp` in the SAME GoTrue OTP storage class, so it verifies correctly under `type:'email'`. A code comment must state this so a future reader doesn't switch the generateLink type to `magiclink` and break verify.
- Net-new users (the `uniqueEmail` pattern) still work and remain harmless (no email sent → the ~60s per-email send-rate-limit is moot; local `db reset` wipes leaked users).
- Keep ONE `auth.spec.ts` case on the real Mailpit path (`getOtpFromMailpit`) so the actual email delivery is still smoke-covered.

**Implementation steps:**
1. Add the admin client + `getOtpViaAdmin` to `e2e/helpers.ts`.
2. Repoint `signIn`'s OTP source to `getOtpViaAdmin`; drop the `clearMailpit`/`Check your email` inbox dependency from the fast path (keep the page interaction).
3. Mark one `auth.spec.ts` test as the real-OTP coverage path (still uses Mailpit).
4. Run `pnpm exec playwright test` locally (or a representative subset) — confirm green + no Mailpit polling in `signIn`.

**Acceptance (verifiable):**
- `grep -c "getOtpFromMailpit" e2e/helpers.ts` — still defined (for the coverage spec) but `signIn` no longer calls it: `grep -A30 "export async function signIn" e2e/helpers.ts | grep -c getOtpFromMailpit` == 0.
- `grep -c "generateLink\|admin.createUser" e2e/helpers.ts` ≥ 1.
- E2E suite green in CI; the recurring `getOtpFromMailpit timed out` no longer gates specs that authenticate via `signIn`.
- One spec still exercises the real OTP email path (grep `getOtpFromMailpit` in `e2e/auth.spec.ts`).
- **(opus S3) Invite path:** `acceptInviteAsNewUser` (`e2e/helpers.ts:194-213`) ALSO depends on `getOtpFromMailpit`. If the same admin-OTP swap applies cleanly (it should — invitee is a new email), apply it in this track and the flake is gone for invite specs too. If it's materially different (invite-link verify vs OTP-entry), leave it Mailpit-bound and narrow the claim to "the `signIn` path"; seed a one-line follow-up. State which in the PR.

**Risk + mitigations:** *service-role key not in CI E2E env* → read from env with the documented local default fallback; CI already runs local supabase for E2E. *generateLink shape drift* → `properties.email_otp` is the documented GoTrue field; assert it's present, fail loud if null.

### Track 2 — TD-219: Rich scenario seed + guarded prod-test-account populate

**FILES ALLOWED:**
- `supabase/seed.sql` (extend the existing idempotent `DO $$` block into a rich scenario — local/staging only; `seed.sql` runs on `supabase db reset`, never against prod).
- `scripts/seed-prod-test-accounts.mjs` (new — Node + `@supabase/supabase-js` service-role; populate the 4 prod test accounts).
- `scripts/README` or a short header in the script documenting the env-flag guard + the 4 emails.
- `package.json` (optional `seed:prod-test` script alias — guarded).

**FILES OUT OF SCOPE:** migrations (schema unchanged), product code, `BACKLOG.md`.

**Branch:** `chore/td-219-rich-seed` off base SHA.

**Model:** `opus-direct` — the prod-populate script is security-adjacent (service-role prod write); root implements with the threat controls baked in.

**Scenario content (both seed.sql + the script build the same shape via a shared mental model):**
- 2 care recipients in one org; 4–5 members across `coordinator`/`caregiver`/`supporter`/`aide` (accepted memberships, some recipient-scoped).
- Journal: `care_events` spanning several weeks — entries across all moods + at least one `flagged` entry + a few with comments.
- Medications: a few active, ≥1 low-supply (`supply_days_remaining <= 7`) to make the refill surface non-empty.
- Shifts: a week of shifts incl. ≥1 `shift_type='on_call'` (exercises ON-81 routing) + a future one (for ON-82 later).
- Tasks: several across `todo`/`in_progress`/`done`/`cancelled`, some with checklists + assignments + a `shift_id` pin (exercises ON-79b/ON-81).
- Documents, expenses, mood entries — enough to make each panel non-empty.

**Threat controls (folded in as acceptance — TD-219 prod-write path):**
- **Synthetic data only** — no real names/PHI; clearly-fake identifiers (e.g. "Test Recipient A").
- **Explicit env-flag guard** — the script refuses to run unless `SEED_PROD_TEST=1` AND a target URL + `SUPABASE_SERVICE_ROLE_KEY` are set; prints what it will do and the target host before writing.
- **Idempotent** — re-running creates no duplicates (existence checks / upserts keyed on the 4 emails + a dedicated test org).
- **Scoped to a dedicated test org** — never reads or writes real customer rows; all content hangs off the test org/recipients it owns.
- **Secret hygiene** — service-role key by env var only; never echoed/logged/committed (per CLAUDE.md).

**Implementation steps:**
1. Extend `supabase/seed.sql` with the scenario (idempotent DO block); `supabase db reset` → confirm every panel is non-empty locally.
2. Write `scripts/seed-prod-test-accounts.mjs` — env-flag-guarded, idempotent, synthetic, scoped to a test org; `auth.admin.createUser` for the 4 emails (`email_confirm: true`) + scenario content.
3. Dry-run guard test: running without `SEED_PROD_TEST=1` exits with a clear message and writes nothing.

**Acceptance (verifiable):**
- After `supabase db reset`: `for t in care_events tasks shifts medications in_app_notifications expenses; do psql "$DBURL" -tAc "select count(*) from $t" ; done` all > 0 (each panel non-empty). Static check: `for t in care_events tasks shifts medications expenses; do grep -ciE "insert into (public\.)?$t" supabase/seed.sql; done` each ≥ 1.
- `scripts/seed-prod-test-accounts.mjs` exits non-destructively without `SEED_PROD_TEST=1` (guard test).
- `grep -n "SUPABASE_SERVICE_ROLE_KEY" scripts/seed-prod-test-accounts.mjs` — key from env only; `! grep -iE "real-name|actual PHI"` (synthetic only).
- vitest unaffected (no product code touched); typecheck/lint clean on the new script.

**Risk + mitigations:** *accidental prod write* → double guard (env flag + explicit target host echo + dedicated test org). *seed.sql drift vs schema* → run `supabase db reset` end-to-end before commit (the seed runs as part of reset). *script run against the wrong project* → print target host + require confirmation env.

## Merge order

Independent (disjoint files). **TD-220 first** (green CI helps TD-219's PR), then TD-219. Both off `db6bec9`.

## Execution gate

`/opus-on-opus docs/plans/2026-05-20-td-220-219-testing-foundation.md --from-sprint`. Apply must-fix.

## Post-merge verification

- TD-220: `git pull && pnpm exec playwright test` (or CI E2E) green; observe no Mailpit timeout on non-auth specs.
- TD-219: `supabase db reset` produces a fully populated dashboard; the prod script's guard verified in a dry run (do NOT run the live prod populate from the pipeline — that's a manual operator step once the 4 accounts are confirmed).

## Open questions

- The 4 prod test emails: the script should read them from env/config, not hardcode. Confirm you'll supply them at run time (operator step), not commit them.
