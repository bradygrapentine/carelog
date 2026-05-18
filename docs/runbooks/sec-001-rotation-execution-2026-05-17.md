# SEC-001 Production Secrets Rotation — Execution Runbook

Interactive runbook for the SEC-001 rotation session. Operationalizes [`deploy-fix-and-live-test.md`](./deploy-fix-and-live-test.md) with the per-secret bisect discipline, but prepends two blocking spikes that must clear before the rotation loop starts. Block off ~75 min total (~15 min spikes + ~45 min runbook + ~15 min close-out).

Do not skip Phase 0. Without Spike 1 + Spike 2 cleared, the per-secret verification step is unreliable.

## 1. Prerequisites

- [ ] On a clean main with no in-flight PRs that would race with redeploy

```bash
git fetch origin && git status && gh pr list --state open --limit 5
```

> Ask: "from /Users/bradygrapentine/projects/carelog, run `git fetch origin && git status && gh pr list --state open --limit 5` and report whether main is clean and what PRs are open"

- [ ] Confirm you're the only deploying operator right now (no parallel teammate redeploys)
- [ ] Vercel CLI authenticated and pointed at carelog

```bash
cd apps/web && vercel whoami && vercel project ls | head -5
```

- [ ] 1Password / password manager open and ready to receive 6 new secret values
- [ ] Six dashboards open in tabs (avoids context-switch errors mid-rotation):

  [Supabase project settings → API](https://supabase.com/dashboard/project/_/settings/api)

  [Stripe webhooks](https://dashboard.stripe.com/webhooks)

  [Resend API keys](https://resend.com/api-keys)

  [Inngest signing keys](https://app.inngest.com/env/production/manage/signing-key)

  [Upstash console](https://console.upstash.com/)

  [Vercel project env vars](https://vercel.com/bradygrapentines-projects/carelog/settings/environment-variables)

- [ ] Block off ~75 min. Stripe webhook step has a brief window where signature failures are possible — schedule during low traffic if possible.

> Watch: do NOT begin rotation until Phase 0 spikes pass. Rotating without a confirmed prod-deploy path leaves you blind to which secret broke what.

## 2. Phase 0 — Pre-execution spikes

### 2a. Spike 1 — Vercel production deploy reality check

Background: root `vercel.json` `ignoreCommand` exits 1 on `main` ref → automatic production deploys from main pushes are skipped by design (PR #573). CLI `vercel --prod` should bypass that, but PR #593's preview hit "build-rate-limit — retry in 24 hours" which may or may not affect CLI prod deploys account-wide.

- [ ] Find what commit SHA is currently running production

```bash
cd apps/web && vercel inspect $(vercel ls --prod 2>/dev/null | grep Ready | head -1 | awk '{print $2}')
```

> Ask: "from /Users/bradygrapentine/projects/carelog/apps/web, use Vercel CLI or MCP to find the most-recent READY production deployment's commit SHA and creation timestamp, then compare to `git rev-parse origin/main`. Report the gap in commits and time."

- [ ] Attempt a no-op `vercel --prod` to confirm CLI deploys land. If `apps/web/vercel.json` ignoreCommand (the path-based filter) skips it, use `--force`

```bash
cd apps/web && vercel --prod --force
```

- [ ] Watch the deploy state in the Vercel dashboard. If it lands READY, CLI prod deploys work — proceed. If it lands CANCELED with "build-rate-limit", STOP and wait for quota window.

> Watch: if the no-op deploy lands READY but takes >5 min, factor that into the rotation budget — 5 redeploys × deploy duration = total wait.

- [ ] Record the result here:

```
Spike 1 result <YYYY-MM-DD HH:MM>:
- Current prod SHA: <sha>
- Gap from main: <N commits, T duration>
- CLI prod deploy works: yes / no — <reason>
- Expected per-deploy duration: <N min>
```

### 2b. Spike 2 — TD-146 Inngest pre-rotation baseline

Background: 2026-05-15 audit showed 0 cron events in 24h in Inngest production despite ~387 cron firings/day expected. Capture baseline BEFORE rotating Inngest keys so we can attribute post-rotation behavior correctly.

- [ ] Open Inngest production [Runs page](https://app.inngest.com/env/production/runs)
- [ ] Count runs in the last 24h. Note the most recent scheduled-cron fire timestamp (if any).

> Ask: "fetch the last 24h of Inngest run events for the carelog production environment via the Inngest dashboard or API, count total runs, identify the most recent scheduled-cron event, and report. Reference TD-146 in /Users/bradygrapentine/projects/carelog/BACKLOG.md if the count is still zero."

- [ ] Record the baseline here:

```
Inngest baseline <YYYY-MM-DD HH:MM>:
- Runs in last 24h: <N>
- Last cron fire: <timestamp> for <function>
- Notes: <anomalies>
```

### 2c. Spike 3 (OPTIONAL) — Stripe webhook signature pre-check

Skip if the most recent prod deploy is older than the most recent Stripe webhook secret rotation in dashboard history.

- [ ] In Stripe dashboard → Webhooks → endpoint → "Send test event" (use `invoice.payment_succeeded`)
- [ ] Check delivery log — 200 means current state is consistent; 400 means pre-existing mismatch to clean up BEFORE adding another rotation

## 3. Phase 1 — UPSTASH_REDIS_REST_TOKEN

Lowest blast radius. Failures degrade to permissive rate-limit behavior, not service outage.

- [ ] Open [Upstash console](https://console.upstash.com/) → carelog Redis instance → REST tokens
- [ ] Generate new token, capture into 1Password BEFORE revealing
- [ ] Copy new value to clipboard

> Watch: never paste the new value into a terminal, file, or chat. Clipboard → Vercel field → clear clipboard.

- [ ] Update Vercel: Project → Settings → Environment Variables → `UPSTASH_REDIS_REST_TOKEN` → Edit → paste → Save (Production environment only)

OR via CLI from `apps/web/`:

```bash
vercel env rm UPSTASH_REDIS_REST_TOKEN production
vercel env add UPSTASH_REDIS_REST_TOKEN production
```

- [ ] Confirm presence (NOT value)

```bash
cd apps/web && vercel env ls production | grep UPSTASH_REDIS_REST_TOKEN
```

- [ ] Redeploy production

```bash
cd apps/web && vercel --prod --force
```

> Cowork: "from /Users/bradygrapentine/projects/carelog/apps/web, run `vercel --prod --force` and tail the build until status is Ready. Report the deployment URL, build duration, and any warnings. Do NOT print env var values from the build log."

- [ ] Verify: hit a rate-limited endpoint, observe headers

```bash
curl -sI https://caresync.app/api/onboarding/create | grep -i 'ratelimit\|x-ratelimit'
```

> Ask: "run `curl -sI https://caresync.app/api/onboarding/create | grep -i 'ratelimit'` and report whether x-ratelimit-* headers are present and the values are sensible (not 0)"

- [ ] Old Upstash token revoked at source (Upstash dashboard → "Revoke" the previous token entry)

## 4. Phase 2 — RESEND_API_KEY

- [ ] Open [Resend API keys](https://resend.com/api-keys)
- [ ] Create new key (Full Access), capture into 1Password
- [ ] Update Vercel `RESEND_API_KEY` (Production only)

```bash
cd apps/web && vercel env rm RESEND_API_KEY production && vercel env add RESEND_API_KEY production
```

- [ ] Redeploy production

```bash
cd apps/web && vercel --prod --force
```

- [ ] Verify: trigger a magic-link send to test account

> Ask: "send a magic-link to brady.grapentine@gmail.com via the caresync.app signin flow (or trigger via the auth API), then confirm receipt in the inbox within 60s. Report subject line and arrival timestamp."

- [ ] Revoke old Resend API key in dashboard

## 5. Phase 3 — INNGEST_SIGNING_KEY + INNGEST_EVENT_KEY (paired)

Rotate BOTH keys together. Inngest pairs the signing key (function → Inngest) with the event key (Inngest → function); rotating one without the other breaks the loop.

- [ ] Open [Inngest signing keys → production](https://app.inngest.com/env/production/manage/signing-key)
- [ ] Generate new signing key, capture
- [ ] Generate new event key, capture
- [ ] Update Vercel: `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY` (both, Production)

```bash
cd apps/web && vercel env rm INNGEST_SIGNING_KEY production && vercel env add INNGEST_SIGNING_KEY production
cd apps/web && vercel env rm INNGEST_EVENT_KEY production && vercel env add INNGEST_EVENT_KEY production
```

- [ ] Redeploy production

```bash
cd apps/web && vercel --prod --force
```

- [ ] Verify: trigger a manual event from Inngest dashboard ("Send Event" → any registered event), confirm "Success" in Runs

> Ask: "from the Inngest production dashboard, send a test event for the most-frequently-fired registered function and confirm the run appears in the Runs list with status 'Success' within 30s. Report the function name and the run id."

- [ ] **TD-146 follow-up check:** count cron events in the last 60 min since redeploy. Compare to Spike 2 baseline.

> Ask: "fetch the last 60 min of Inngest run events for carelog production, count total scheduled-cron firings (exclude manually-triggered events), and compare to the Spike 2 baseline. If still zero, escalate TD-146 with this rotation result attached."

- [ ] Revoke old Inngest signing key + event key in dashboard

## 6. Phase 4 — SUPABASE_SERVICE_ROLE_KEY

Higher blast — many endpoints depend on RLS bypass via this key.

- [ ] Open [Supabase API settings](https://supabase.com/dashboard/project/_/settings/api)
- [ ] Reveal "service_role" key. **Note:** Supabase doesn't rotate this in-dashboard — you must regenerate the JWT secret (which invalidates BOTH anon + service_role and forces all clients to refresh). If avoiding that blast, instead rotate at the auth layer (only if you have a custom JWT setup; default Supabase setup forces JWT-secret regeneration).

> Watch: rotating `SUPABASE_SERVICE_ROLE_KEY` via JWT-secret regeneration invalidates anon-key sessions too. Confirm with the user before regenerating. Otherwise scope this rotation as: "Supabase JWT secret regenerated, both keys refreshed, anon clients re-authenticate."

- [ ] Capture new service_role + anon keys into 1Password
- [ ] Update Vercel: `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (both, Production)

```bash
cd apps/web && vercel env rm SUPABASE_SERVICE_ROLE_KEY production && vercel env add SUPABASE_SERVICE_ROLE_KEY production
cd apps/web && vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY production && vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```

> Watch: `NEXT_PUBLIC_*` vars are bundled into the build, NOT read at runtime. The redeploy is mandatory after this one — without it, the client-side Supabase still uses the old anon key.

- [ ] Redeploy production

```bash
cd apps/web && vercel --prod --force
```

- [ ] Verify: sign up a throwaway account in incognito at [caresync.app](https://caresync.app)

- [ ] Confirm `/api/onboarding/create` returns 200 in Vercel runtime logs

> Ask: "fetch the last 10 minutes of Vercel runtime logs for the carelog production deployment, filter for /api/onboarding/create, and report any non-200 responses with their error messages. If 500 + 'row violates row-level security policy', the new service-role key didn't propagate — flag immediately."

- [ ] Revoke old keys (automatic with JWT secret regeneration; otherwise revoke in dashboard)

## 7. Phase 5 — STRIPE_WEBHOOK_SECRET (LAST)

Last because: Stripe retries 400-response webhooks aggressively for up to 3 days. Any window where the OLD secret is bundled in prod but the NEW secret is in Stripe will generate retry noise.

- [ ] Open [Stripe webhooks](https://dashboard.stripe.com/webhooks)
- [ ] Find the carelog production webhook endpoint
- [ ] Click "Roll secret" (Stripe's native rotation; old secret stays valid for a grace window)
- [ ] Capture new signing secret into 1Password
- [ ] Update Vercel `STRIPE_WEBHOOK_SECRET` (Production)

```bash
cd apps/web && vercel env rm STRIPE_WEBHOOK_SECRET production && vercel env add STRIPE_WEBHOOK_SECRET production
```

- [ ] Redeploy production

```bash
cd apps/web && vercel --prod --force
```

- [ ] Verify within 60s of redeploy completing: Stripe dashboard → Webhooks → endpoint → "Send test event" (`invoice.payment_succeeded`)

> Ask: "send a test `invoice.payment_succeeded` event from the Stripe dashboard for the carelog production endpoint and confirm a 200 response in Stripe's delivery log within 10s. Then check Vercel runtime logs for the corresponding handler log line."

- [ ] Send a request with a STALE signature (saved curl from before rotation) — expect 400. Confirms old secret is dead.
- [ ] Expire the OLD secret in Stripe (after grace window confirms no retry noise)

> Watch: Stripe sometimes keeps the old secret in "Available signing secrets" for backward compat. Click "Expire" on the old one explicitly once you've confirmed the new one works.

## 8. Phase 6 — Post-rotation local dev hygiene

- [ ] Replace `apps/web/.env.local` with **dev-tier** values, not the just-rotated prod values

```bash
cd apps/web && vercel env pull --environment=development .env.local
```

- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` in the new `.env.local` begins with `eyJ` (local Supabase JWT, not `sb_secret_*`)

```bash
cd apps/web && grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | head -c 50 && echo ...
```

> Ask: "from /Users/bradygrapentine/projects/carelog/apps/web, confirm `.env.local` now begins with `# Created by Vercel CLI` and the SUPABASE_SERVICE_ROLE_KEY line starts with 'eyJ'. Do NOT print the full key value."

- [ ] Add the `vepull` alias to your zsh profile (per [SECRETS_ROTATION.md](../project-info/runbooks/SECRETS_ROTATION.md) Part 3)
- [ ] Restart `pnpm web` and confirm care-team creation still works locally

```bash
pnpm web
```

## 9. Phase 7 — Close-out

- [ ] Update SEC-001 checklist in [SECRETS_ROTATION.md](../project-info/runbooks/SECRETS_ROTATION.md) (the copy-to-PR block at lines 56-73)
- [ ] Run `/backlog-sync` to flip SEC-001 row to ✅ Shipped
- [ ] If TD-146 cron-firing was resolved by Inngest rotation, note that in the TD-146 row and close

> Ask: "from /Users/bradygrapentine/projects/carelog, invoke the /backlog-sync skill to promote SEC-001 to shipped and update TD-146 with the Inngest cron-firing observation from this rotation session"

- [ ] Git history scrub check:

```bash
git log --all --full-history --source -- apps/web/.env.local
git log --all -p -S "sb_secret_NBtixZ" 2>/dev/null
git log --all -p -S "signkey-prod-" 2>/dev/null
```

- [ ] If any output above: STOP and escalate. If empty: scrub not needed.
- [ ] Notify any teammates that production secrets rotated — they need to re-pull dev env

## 10. Verification (rotation complete when ALL true)

- [ ] Spike 1 captured prod-deploy reality
- [ ] Spike 2 captured Inngest baseline
- [ ] Phases 1–5 each completed their §verify step (5 endpoints exercised, 5 success signals captured)
- [ ] Post-rotation `.env.local` has `eyJ`-prefixed Supabase service role key
- [ ] BACKLOG.md SEC-001 row shows ✅ Shipped (via `/backlog-sync` PR)
- [ ] TD-146 observation recorded (whether rotation fixed crons or not)
- [ ] Git history scrub returned empty
- [ ] All 6 old secrets revoked at source

> Watch: rotation is NOT complete until the OLD keys are revoked. Updating Vercel with new values while leaving old keys live at source means a leaked old key is still a vulnerability.

## 11. Rollback (if a rotation breaks production)

Last resort only. The correct path is almost always to fix forward — diagnose why the new key didn't take effect (Phase 1–5 redeploy "Watch" notes), and redeploy.

- [ ] Vercel dashboard → Settings → Environment Variables → variable → History → restore previous value
- [ ] Redeploy production

```bash
cd apps/web && vercel --prod --force
```

- [ ] Verify the affected surface
- [ ] Confirm at source dashboard whether the OLD key was already revoked:
  - Supabase / Resend / Upstash: revocation is immediate; rollback won't help. Must roll forward.
  - Stripe / Inngest: signing keys can sometimes coexist briefly. Confirm in dashboard.

## Related

- [`deploy-fix-and-live-test.md`](./deploy-fix-and-live-test.md) — the source runbook this operationalizes
- [`SECRETS_ROTATION.md`](../project-info/runbooks/SECRETS_ROTATION.md) — base rotation procedure
- [`SECRETS_ROTATION-audit-2026-05-14.md`](../project-info/runbooks/SECRETS_ROTATION-audit-2026-05-14.md) — pre-rotation audit
- [`docs/plans/2026-05-17-sec-001-rotation-execution.md`](../plans/2026-05-17-sec-001-rotation-execution.md) — plan doc with risk analysis
- `BACKLOG.md` — SEC-001 + TD-146 rows
