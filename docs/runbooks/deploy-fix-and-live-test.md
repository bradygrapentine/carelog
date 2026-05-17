# Deploy Fix + Live Test (SEC-001 sequencing)

Operational runbook for redeploying production after a secret rotation OR after a deployment-time error. Sequencing matters: **rotation must complete per-secret before redeploy, and redeploy must complete before live verification, or the verification step will fail and pollute the signal.**

Tied to SEC-001 (secrets rotation, see `docs/project-info/runbooks/SECRETS_ROTATION.md`). At time of writing, **rotation has NOT yet been executed** — Part 1 walks through it for the first time. If you've already rotated, skip to Part 3.

> Note: this runbook is per-secret. Run Parts 2 + 3 once for EACH of the 6 secrets. Do not batch-rotate then batch-verify — you lose the ability to bisect a failure to a specific secret.

---

## 1. Pre-flight

- [ ] Confirm you're the only deploying operator right now (no parallel teammate redeploys)
- [ ] On a clean main with no in-flight PRs that would race with redeploy

```bash
git fetch origin && git status && gh pr list --state open --limit 5
```

> Ask: "from /Users/bradygrapentine/projects/carelog, run `git fetch origin && git status && gh pr list --state open --limit 5` and report whether main is clean and what PRs are open"

- [ ] Vercel CLI authenticated and on the right project

```bash
cd apps/web && vercel whoami && vercel project ls | head -5
```

- [ ] Have password manager / 1Password open and ready to receive 6 new secret values
- [ ] Have these 6 dashboards open in tabs (avoids context-switch errors mid-rotation):

  [Supabase project settings → API](https://supabase.com/dashboard/project/_/settings/api)
  [Stripe webhooks](https://dashboard.stripe.com/webhooks)
  [Resend API keys](https://resend.com/api-keys)
  [Inngest signing keys](https://app.inngest.com/env/production/manage/signing-key)
  [Upstash console](https://console.upstash.com/)
  [Vercel project env vars](https://vercel.com/dashboard) → carelog → Settings → Environment Variables

- [ ] Block off ~45 min. Stripe webhook step has a brief window where signature failures are possible — schedule during low traffic if possible.

> Watch: do NOT begin rotation until you have Part 3 (verification commands) understood. Rotating without immediate verification leaves you blind to which secret broke what.

---

## 2. Rotation order (do these one at a time, full loop per secret)

The order is chosen to minimize blast radius: lowest-traffic surfaces first, Stripe webhook LAST (it's the most sensitive to a stale-signature window).

| Order | Secret | Surface tested | Why this order |
|---|---|---|---|
| 1 | `UPSTASH_REDIS_REST_TOKEN` | rate limiter | Low blast — failures degrade to permissive |
| 2 | `RESEND_API_KEY` | transactional email | Easy to test, no inbound traffic at risk |
| 3 | `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY` | background jobs / crons | Rotate both together (paired keys); see TD-146 cron-firing concern below |
| 4 | `SUPABASE_SERVICE_ROLE_KEY` | RLS-bypass endpoints | Higher blast — many endpoints depend |
| 5 | `STRIPE_WEBHOOK_SECRET` | billing webhooks | Last — narrow signature-failure window |

For EACH row above, run Part 3 in full before moving to the next row.

---

## 3. The per-secret loop (rotate → update Vercel → redeploy → verify)

> Tip: this is the loop you'll run 5 times (Inngest's 2 keys roll together). Bookmark this section.

### 3a. Rotate in source dashboard

- [ ] Open the dashboard tab for the current secret
- [ ] Capture the new value into 1Password / password manager **before** revealing it
- [ ] Copy the new value to clipboard

> Watch: never paste the new value into a terminal, file, or chat. Clipboard → Vercel field → clear clipboard.

### 3b. Update Vercel (Production environment only)

- [ ] In Vercel dashboard: Project → Settings → Environment Variables → find the variable → Edit → paste → Save

OR via CLI from `apps/web/`:

```bash
vercel env rm <NAME> production
vercel env add <NAME> production
# paste new value when prompted
```

> Ask: "from /Users/bradygrapentine/projects/carelog/apps/web, list current Vercel production env vars with `vercel env ls production | head -30` and confirm <NAME> is present (do NOT print values)"

- [ ] Confirm `<NAME>` still listed in production env after edit (presence check, not value check)

### 3c. Redeploy production

> Cowork: "from /Users/bradygrapentine/projects/carelog/apps/web, run `vercel --prod` to redeploy carelog production. Tail the build until the new deployment is live (status: Ready). Report the deployment URL, build duration, and any warnings. Do NOT print env var values from the build log."

- [ ] Confirm Vercel dashboard shows new deployment as "Ready"
- [ ] Click through to the deployment and verify the commit SHA matches `git rev-parse origin/main`

> Watch: if redeploy lands but the new env var didn't propagate (rare Vercel cache bug), the new deployment will still hold the OLD value. Symptom: verification in 3d fails identically to pre-rotation. Recovery: `vercel env pull --environment=production .env.production.local` in a scratch dir, grep for the var to confirm propagation, then redeploy again.

### 3d. Live verification (the actual "live test")

Match the row from Part 2 to its verification:

#### Upstash (rate limiter)

- [ ] Hit any rate-limited endpoint from a curl, observe response headers

```bash
curl -sI https://caresync.app/api/onboarding/create | grep -i 'ratelimit\|x-ratelimit'
```

> Ask: "run `curl -sI https://caresync.app/api/onboarding/create | grep -i 'ratelimit'` and report whether x-ratelimit-* headers are present and the values are sensible (not 0)"

#### Resend (email)

- [ ] Trigger a magic-link send to your own test account
- [ ] Confirm receipt in inbox within 60s

Test account: `brady.grapentine@gmail.com` (per project memory — production superuser test account).

#### Inngest (jobs + crons)

- [ ] Trigger a job manually via the Inngest dashboard ("Send Event" → any registered event)
- [ ] Confirm the run appears in the Runs list with status "Success"
- [ ] **TD-146 check**: inspect the cron-events feed for the last 60 min — confirm at least ONE scheduled cron has fired since redeploy

> Watch: TD-146 (2026-05-15 audit) found Inngest production showed zero events in 24h despite ~387 cron firings/day expected. After rotating Inngest keys, verify crons are actually firing — this rotation is the natural moment to re-check. If still zero events, escalate to TD-146 investigation (Hobby tier metric window may be the cause, but rule out env-gated cron registration).

> Ask: "fetch the last 24h of Inngest run events for the production env via the Inngest API or dashboard, count total runs, and report. Reference TD-146 in /Users/bradygrapentine/projects/carelog/BACKLOG.md if the count is still zero."

#### Supabase service role

- [ ] Hit an RLS-bypassing endpoint with a fresh signup flow

```bash
# trigger by signing up a throwaway account in incognito at caresync.app
```

- [ ] Confirm `/api/onboarding/create` returns 200 (Vercel runtime logs)
- [ ] If 500 + "row violates row-level security policy": the new service-role key didn't propagate. Go back to 3c.

> Ask: "fetch the last 10 minutes of Vercel runtime logs for the carelog production deployment, filter for /api/onboarding/create, and report any non-200 responses with their error messages"

#### Stripe webhook (LAST — see Part 2 ordering)

- [ ] In Stripe dashboard → Webhooks → endpoint → "Send test event" (use `invoice.payment_succeeded`)
- [ ] Confirm 200 response in Stripe's delivery log within 10s
- [ ] Confirm corresponding handler log line in Vercel runtime logs

> Watch: Stripe retries 400s aggressively for up to 3 days. Any window where the OLD secret is in the deployed function but the NEW secret is in Stripe will generate retry noise. Verify within 60s of redeploy completing.

- [ ] Send a request with a STALE signature (use a saved curl from before rotation) → expect 400. This confirms the old secret is dead.

### 3e. Loop or proceed

- [ ] If more secrets remain in Part 2, return to 3a with the next secret
- [ ] If all 6 rotated + verified, proceed to Part 4

---

## 4. Post-rotation: local dev hygiene (Part 3 of SECRETS_ROTATION.md)

- [ ] Replace `apps/web/.env.local` with **dev-tier** values, not the just-rotated prod values

```bash
cd apps/web && vercel env pull --environment=development .env.local
```

- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` in the new `.env.local` begins with `eyJ` (local Supabase JWT, not `sb_secret_*`)

```bash
cd apps/web && grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | head -c 50 && echo ...
```

- [ ] Add the `vepull` alias to your zsh profile (per SECRETS_ROTATION.md Part 3)
- [ ] Restart `pnpm web` and confirm care-team creation still works locally

```bash
pnpm web
```

> Ask: "from /Users/bradygrapentine/projects/carelog/apps/web, confirm `.env.local` now begins with `# Created by Vercel CLI` and the SUPABASE_SERVICE_ROLE_KEY line starts with 'eyJ'. Do NOT print the full key value."

---

## 5. Close-out

- [ ] Update SEC-001 checklist in `docs/project-info/runbooks/SECRETS_ROTATION.md` (the copy-to-PR block at lines 56-73)
- [ ] Run `/backlog-sync` to flip SEC-001 row to ✅ Shipped
- [ ] If TD-146 cron-firing was resolved by Inngest rotation, note that in the TD-146 row and close

> Ask: "from /Users/bradygrapentine/projects/carelog, invoke the /backlog-sync skill to promote SEC-001 to shipped and update TD-146 with the Inngest cron-firing finding from tonight's rotation"

- [ ] Git history scrub check (per SECRETS_ROTATION.md lines 75-85):

```bash
git log --all --full-history --source -- apps/web/.env.local
git log --all -p -S "sb_secret_NBtixZ" 2>/dev/null
git log --all -p -S "signkey-prod-" 2>/dev/null
```

- [ ] If any output above: STOP and escalate. If empty: scrub not needed.

- [ ] Notify any teammates that production secrets rotated — they need to re-pull dev env

---

## 6. Rollback (if a rotation breaks production)

Vercel keeps env-var history. If a freshly-rotated secret breaks production AND you cannot quickly fix:

- [ ] Vercel dashboard → Settings → Environment Variables → variable → History → restore previous value
- [ ] Redeploy production
- [ ] Verify the affected surface
- [ ] DO NOT consider this success — the OLD key is now back in active use but the source dashboard may have already revoked it. Coordinate immediately:
  - Supabase / Resend / Upstash: revocation is immediate; rollback won't help. Must roll forward.
  - Stripe / Inngest: signing keys can sometimes coexist briefly. Confirm in dashboard.

> Watch: rollback is a last resort. The correct path is almost always to fix forward — diagnose why the new key didn't take effect (3c "Watch" note), and redeploy.

---

## Related

- `docs/project-info/runbooks/SECRETS_ROTATION.md` — the source rotation runbook (this runbook operationalizes its sequencing)
- `docs/project-info/runbooks/SECRETS_ROTATION-audit-2026-05-14.md` — 2026-05-14 audit findings
- `docs/research/2026-05-15-inngest-vs-queues.md` §6.6 — TD-146 cron-firing concern raised tonight
- `BACKLOG.md` — SEC-001 and TD-146 rows
