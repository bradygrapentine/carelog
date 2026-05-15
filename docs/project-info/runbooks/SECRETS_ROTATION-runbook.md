# SEC-001 — Production Secrets Rotation (Interactive)

Step-by-step rotation of the 6 production secrets that landed in `apps/web/.env.local` via `vercel env pull` on 2026-05-10. Companion to the reference doc at [SECRETS_ROTATION.md](./SECRETS_ROTATION.md) — that file explains *why*; this one is the clickable checklist for *when*. The 2026-05-14 audit memo at [SECRETS_ROTATION-audit-2026-05-14.md](./SECRETS_ROTATION-audit-2026-05-14.md) confirms the reference doc is operationally accurate.

> Watch: Schedule the rotation when production traffic is low. Stripe webhook secret roll has the narrowest verification window — old-signature requests fail with 400 between rotation and redeploy.

> Tip: Capture each new secret in a password manager (1Password, OS keychain) as you rotate. Never paste into a plaintext file. The point of this exercise is to *stop* having prod keys on disk.

---

## 1. Prerequisites

- [ ] Logged into the Vercel dashboard for the `carelog` project: [Vercel project settings](https://vercel.com/dashboard)

- [ ] Logged into all 5 secret-source dashboards in separate browser tabs:
  - [Supabase Dashboard](https://supabase.com/dashboard)
  - [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
  - [Resend Dashboard → API Keys](https://resend.com/api-keys)
  - [Inngest Dashboard](https://app.inngest.com)
  - [Upstash Dashboard](https://console.upstash.com)

- [ ] Vercel CLI installed and authenticated locally — verify with `vercel whoami`

```bash
vercel whoami
```

- [ ] On a clean branch (not main) for the post-rotation `.env.local` swap commit; or accept that the `.env.local` will only change locally and never enter git (it's gitignored — see step 8)

- [ ] Password manager open and ready to receive the 6 new secrets

> Note: `VERCEL_OIDC_TOKEN` is NOT in this list. It rotates itself (short-lived per-environment JWT). No action required.

---

## 2. Rotate `SUPABASE_SERVICE_ROLE_KEY`

- [ ] In Supabase dashboard, go to: Project Settings → API → find "service_role" key → click "Reset"

- [ ] Capture the new key (starts with `sb_secret_...` for production projects). Save to password manager.

- [ ] Update Vercel (Production environment only) via the web UI: Project → Settings → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY` → Edit → paste new value → Save.

  Or via CLI:

```bash
vercel env rm SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

- [ ] Redeploy production

```bash
vercel --prod
```

- [ ] Verify the new key works — send a request that exercises `supabaseAdmin`:

> Ask: "in carelog, run `curl -sS -X POST https://care-log.org/api/onboarding/create -H 'Content-Type: application/json' -d '{\"name\":\"Rotation Test\"}'` and report the HTTP status + body. Anything that's not 200/400 means the new service role key isn't loading correctly."

> Watch: A 500 with body `"violates row-level security policy"` means the new key didn't take. The admin client fell back to anon role, RLS correctly blocked. Double-check the Vercel env var actually updated AND a fresh deploy fired.

---

## 3. Rotate `RESEND_API_KEY`

- [ ] In Resend dashboard → API keys → revoke the current production key → "Create API Key" → name it `carelog-prod-<date>`

- [ ] Capture the new key (starts with `re_...`). Save to password manager.

- [ ] Update Vercel production env:

```bash
vercel env rm RESEND_API_KEY production
vercel env add RESEND_API_KEY production
```

- [ ] Redeploy production

```bash
vercel --prod
```

- [ ] Verify by triggering a magic-link sign-in to a test account — confirm the email arrives:

> Ask: "navigate to https://care-log.org/signin, enter a test email I control (use brady.grapentine+rotation@gmail.com), submit, then check that mailbox via gmail MCP within 60s and report whether the magic-link email arrived. Don't click the link."

> Watch: If no email after 90s, the rotation didn't take. Check Resend dashboard "Activity" tab for delivery status — if zero requests, Vercel didn't pick up the new key.

---

## 4. Rotate `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY`

- [ ] In Inngest dashboard → Apps / Settings → roll the **signing key** (used to verify incoming webhook signatures from Inngest cloud)

- [ ] Roll the **event key** (used by the SDK to publish events). Save BOTH new values to password manager.

- [ ] Update Vercel production env for BOTH:

```bash
vercel env rm INNGEST_SIGNING_KEY production
vercel env add INNGEST_SIGNING_KEY production
vercel env rm INNGEST_EVENT_KEY production
vercel env add INNGEST_EVENT_KEY production
```

- [ ] Redeploy production

```bash
vercel --prod
```

- [ ] Trigger any Inngest function from the dashboard (e.g. "Send Test Event") and confirm it succeeds:

> Ask: "open the Inngest dashboard tab the user has logged in, find the 'Functions' list for the carelog app, pick any function (e.g. weeklyDigest or refillAlert), trigger a test invocation, wait 30 seconds, and report whether the run shows 'Completed' or an error. If error, paste the error message."

> Note: The Inngest keys are NOT findable via grep in `apps/web/` source — the Inngest SDK reads them from `process.env` internally. The audit memo at [SECRETS_ROTATION-audit-2026-05-14.md](./SECRETS_ROTATION-audit-2026-05-14.md) flagged this as a non-obvious gotcha.

---

## 5. Rotate `UPSTASH_REDIS_REST_TOKEN`

- [ ] In Upstash dashboard → your Redis database → "Details" → Reset REST token

- [ ] Capture the new token. Save to password manager.

- [ ] Update Vercel production env:

```bash
vercel env rm UPSTASH_REDIS_REST_TOKEN production
vercel env add UPSTASH_REDIS_REST_TOKEN production
```

- [ ] Redeploy production

```bash
vercel --prod
```

- [ ] Verify rate-limit logic still works — hit any rate-limited endpoint and watch headers:

> Ask: "in carelog, run `curl -sSI https://care-log.org/api/brief/test-token-that-does-not-exist` (or any GET against the brief share endpoint) and report whether the `RateLimit-Remaining` header is present and decrements on subsequent calls. If the header is absent, the Redis token rotation broke the rate limiter."

---

## 6. Rotate `STRIPE_WEBHOOK_SECRET` — last, with care

> Watch: Roll Stripe LAST. Between rotation and redeploy, real webhooks signed with the old secret will fail signature verification (return 400). Stripe retries on 400s, so traffic isn't lost — but you want the window short. Have the Vercel redeploy ready to fire immediately after the dashboard roll.

- [ ] Open both tabs side-by-side: Stripe dashboard webhook settings, and the Vercel CLI in your terminal ready to update env + redeploy.

- [ ] In Stripe dashboard → Developers → Webhooks → find the carelog production endpoint → "Roll signing secret"

- [ ] **Immediately** copy the new secret. Save to password manager.

- [ ] **Immediately** update Vercel production env and redeploy:

```bash
vercel env rm STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel --prod
```

- [ ] Wait for the deploy to complete (typically 30-90s for carelog)

- [ ] Send a test event from the Stripe dashboard → the webhook endpoint → "Send test webhook":

> Ask: "ask the user to send a Stripe `checkout.session.completed` test event from the dashboard, then in 30 seconds check Vercel logs via `vercel logs https://care-log.org --since=2m | grep -i 'stripe/webhook'` and report whether the most-recent invocation returned 200 (success) or 400 (signature verification failure). If 400, the new STRIPE_WEBHOOK_SECRET didn't load."

- [ ] Verify the OLD secret is now rejected — this is the only secret where the runbook explicitly tests fail-closed behavior:

> Ask: "construct a fake Stripe webhook POST with a `Stripe-Signature` header signed using a known-old-bad secret (use any random hex string), send it to https://care-log.org/api/stripe/webhook, and report the HTTP status. A 400 with body mentioning 'signature' means rotation succeeded. A 200 means the old secret somehow still works — that's a P0 — stop and escalate."

---

## 7. Verify all 6 are fail-closed (defense in depth)

Optional but strongly recommended. Spot-check that the old keys actually don't work anywhere.

- [ ] In a scratch terminal, set `OLD_SUPABASE_SERVICE_ROLE_KEY=<the leaked value from .env.local backup if you saved one>` and try the same endpoint as step 2:

```bash
# Replace <OLD_KEY> with the leaked value (DO NOT commit this anywhere)
curl -sS -X POST https://care-log.org/api/onboarding/create \
  -H "Content-Type: application/json" \
  -H "x-supabase-test-override: <OLD_KEY>" \
  -d '{"name":"Old Key Test"}'
```

- [ ] If you didn't save the old leaked values: skip this step. The dashboard-side revocation is immediate for all 5 services; the new-key-works verification in steps 2-6 implicitly confirms the rotation took effect.

> Note: Per the 2026-05-14 audit memo §F6, this fail-closed step is encouraged but not strictly required — all 5 dashboard providers revoke immediately on reset.

---

## 8. Replace local `apps/web/.env.local` with dev-tier secrets

The whole point of this rotation: stop having prod keys on developer disk.

- [ ] In `apps/web/`, replace the prod-pulled `.env.local` with dev-tier values:

```bash
cd apps/web && vercel env pull --environment=development .env.local
```

- [ ] If your Vercel project doesn't have a Development environment populated (you'll get an empty file or missing vars), add Development overrides for each variable in Vercel dashboard → Settings → Environment Variables. Local-tier values (local Supabase JWT, dev Stripe keys, no prod webhook secrets) only.

- [ ] For the local Supabase service-role key specifically, use the JWT shipped with the Supabase CLI (NOT the prod value):

```bash
supabase status -o env
```

  Copy the `SERVICE_ROLE_KEY` line (starts with `eyJ...`) and paste it into `apps/web/.env.local` for the local-dev branch.

- [ ] Add a shell alias so future pulls always grab dev-tier:

```bash
echo "alias vepull='vercel env pull --environment=development .env.local'" >> ~/.zshrc
source ~/.zshrc
```

- [ ] Restart `pnpm web` to pick up the new local env

```bash
pnpm web
```

- [ ] Test a local onboarding create — confirm care-team creation works (this was the original bug that surfaced the leak):

> Ask: "navigate to http://localhost:3000/onboarding in a fresh browser session, complete the onboarding flow with a test email, and report whether care-team creation succeeds (no RLS error). If it 500s with 'violates row-level security policy', the local SUPABASE_SERVICE_ROLE_KEY is still wrong — re-run `supabase status -o env` and re-paste."

---

## 9. SEC-009: Populate Vercel's Development environment tier

After swapping your local `.env.local` (§8), mirror those same dev-tier values into Vercel's **Development** environment slot so `vercel dev` and preview branches use isolated secrets instead of falling back to Production values.

**Steps (Vercel dashboard):**

- [ ] Navigate to **Vercel → Project → Settings → Environment Variables**.
- [ ] For each of the 6 rotated secrets, click the variable row and choose **"Add for Development"** (if only a Production value exists). Paste the local/test-tier value:
  - `SUPABASE_SERVICE_ROLE_KEY` — local service-role key from `supabase status -o env`
  - `STRIPE_WEBHOOK_SECRET` — Stripe CLI webhook secret (`whsec_...`) for local testing
  - `RESEND_API_KEY` — Resend dev/test key (never the production key)
  - `INNGEST_SIGNING_KEY` — Inngest dev signing key
  - `INNGEST_EVENT_KEY` — Inngest dev event key
  - `UPSTASH_REDIS_REST_TOKEN` — Upstash dev-tier token
- [ ] Also set Development values for these non-rotating vars (dev URLs differ from prod):
  - `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Verify the pull works:

```bash
vercel env pull --environment=development .env.local
# Confirm the file contains the local-tier JWT (starts with eyJ) for SUPABASE_SERVICE_ROLE_KEY
grep 'SUPABASE_SERVICE_ROLE_KEY' .env.local | head -1
```

> Ask: "run `vercel env pull --environment=development .env.local && grep SUPABASE_SERVICE_ROLE_KEY .env.local | head -1` and confirm the value starts with `eyJ` (not `sb_live_`). If the pull returns nothing or the value is the production key, the Vercel Development tier was not set — re-open the dashboard and verify the 'Development' checkbox was checked, not only 'Production'."

- [ ] Redeploy any open preview deployments so they pick up the new Development vars:

```bash
vercel --prod=false
```

---

## 10. Scrub git history (sanity check)

`.env.local` is git-ignored, so the leaked secrets should never have entered git. Confirm:

- [ ] Search the full repo history for any of the leaked prefixes:

```bash
git log --all --full-history --source -- apps/web/.env.local
```

  Expect: empty output. Any output means the file did enter git at some point — escalate, run `git filter-repo` to scrub.

- [ ] Search for the specific leaked-secret patterns:

```bash
# Replace <PREFIX> with a short distinctive substring of each old secret
git log --all -p -S "<PREFIX>" 2>/dev/null
```

  Expect: empty output per secret.

> Ask: "in carelog, run `git log --all --full-history --source -- apps/web/.env.local && echo '---' && git log --all -p -S 'sb_secret_' 2>/dev/null | head -20` and report whether either command returns any output. Empty = good. Any output = a leaked secret entered git history and we need to scrub."

---

## 11. Close out SEC-001

- [ ] Confirm the BACKLOG row SEC-001 is still `🔴 In progress · P0` at this point. Once all steps above pass:

> Ask: "in carelog, run `/backlog-sync` and confirm SEC-001 promoted from §1 to §7 with a one-liner summary citing this runbook session. If anything else shifted unexpectedly, surface it."

- [ ] Verify the closeout PR auto-merge fires; check `gh pr list --state open` is clean of any SEC-001-related work.

- [ ] Update your password manager: delete any old-secret entries to avoid confusion next time you grep your vault.

- [ ] (Optional) Schedule a calendar reminder for 90 days from today to revisit the runbook freshness audit memo's §F2/F6 items if they haven't been addressed by then.

- [ ] Once SEC-009's Vercel Development tier is populated (§9), run `/backlog-sync` again to flip SEC-009 to ✅ Shipped.

---

## 12. Optional: enable the new safety nets

These safety nets (TD-134, TD-135, TD-136) were introduced alongside SEC-009 to reduce future exposure. Verify each is wired before marking the rotation complete.

- [ ] **TD-134 — pre-migration check script:** Before opening any migration PR, run `pnpm migration-check` to catch destructive DDL patterns locally before CI sees them. (TD-134 — wired if merged; script at `scripts/migration-check.sh`.)

- [ ] **TD-135 — PostHog feature-flag SDK:** Wrap risky launches (schema changes, new analytics events, auth changes) in a feature flag via `useFeatureFlag('feature_<scope>_<feature>')` so you can roll back without a redeploy. (TD-135 — wired if merged; see `docs/adr/0004-feature-flag-rollout-pattern.md` for the PHI-safe signature.)

- [ ] **TD-136 — migration SQL lint CI gate:** CI will now block migration PRs that contain risky DDL patterns (`DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN ... TYPE` without explicit `USING`, etc.) unless the statement includes a `-- safe-migration: <reason>` annotation. (TD-136 — wired if merged; lint script at `scripts/migration-lint.sh`.)

> If any of the three TDs above show as `🟢 Ready` (not `✅ Shipped`) in BACKLOG.md when you run this runbook, skip that item — the safety net is not yet live.

---

## Common failure modes

> Watch: **"Old key still works" after rotation** — almost always means Vercel didn't pick up the new env var, OR the redeploy didn't fire. Check `vercel deployments ls` shows a fresh deployment timestamp after your env update.

> Watch: **Inngest test event silently 200s but never runs** — the SDK can return success while the platform rejects the signature. Always verify in the Inngest dashboard "Runs" tab, not just the SDK response.

> Watch: **Resend emails go to spam during the rotation window** — if Resend reissue triggers a sender-reputation reset, the first few prod emails may land in spam. Send a few warmup emails to known good addresses before going home for the night.

> Watch: **Stripe webhook 400s pile up** in the minute between roll and redeploy. Stripe retries with exponential backoff so traffic isn't lost, but if the redeploy hangs you'll see hundreds of pending retries on the dashboard. If the redeploy fails for any reason, revert the env var to the OLD secret (you saved it in your password manager, right?) and try again.

---

## Cleanup

- [ ] Delete the password-manager entries for the OLD leaked secrets (after confirming new keys are working everywhere)

- [ ] Verify `apps/web/.env.local` is still gitignored:

```bash
git check-ignore apps/web/.env.local && echo "ignored" || echo "NOT ignored — fix .gitignore"
```

- [ ] Close this runbook tab; rotation complete.

> Tip: If anything went sideways, the reference doc at [SECRETS_ROTATION.md](./SECRETS_ROTATION.md) has the same content in linear form and the audit memo at [SECRETS_ROTATION-audit-2026-05-14.md](./SECRETS_ROTATION-audit-2026-05-14.md) flags the known staleness items.
