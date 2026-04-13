---
name: deploy-autopilot
description: Autonomously ship Carelog to production — typecheck, test, verify env, deploy, smoke test, rollback on failure
---

# deploy-autopilot

Autonomous production-ship workflow for Carelog. Runs end-to-end: preflight -> env verification -> deploy -> smoke -> rollback-on-failure -> report.

Do not proceed past any phase with failures. Abort and report.

## 1. Preflight (all must pass)

Run from repo root. Stop on first failure.

```sh
pnpm typecheck
pnpm test
pnpm lint
supabase test db
```

Gate: every command exits 0. Capture stdout tails for the report.

## 2. Env verification

### Vercel production env
```sh
vercel env ls production
```

Required keys present (non-empty) in Vercel `production`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_FAMILY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`

### Supabase
```sh
supabase projects list
supabase migration list --linked     # confirm no unpushed migrations
supabase db lint --linked
```

### Stripe webhook
```sh
stripe webhook_endpoints list | grep "$NEXT_PUBLIC_SITE_URL/api/stripe/webhook"
```
Endpoint must exist and be enabled for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

### Inngest
Confirm production app is registered at `$NEXT_PUBLIC_SITE_URL/api/inngest`:
```sh
curl -sf "$NEXT_PUBLIC_SITE_URL/api/inngest" | jq '.functions | length'
```

## 3. Domain & email

- `vercel domains ls` — verify custom apex domain attached to project and `Valid Configuration`.
- Resend: confirm sender domain verified:
  ```sh
  curl -sf -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/domains | jq '.data[] | {name, status}'
  ```
  `status` must be `verified` for the sender domain used in `RESEND_FROM_EMAIL`.

## 4. Deploy

Capture previous production deployment for rollback:
```sh
PREV_DEPLOY=$(vercel ls --prod --json | jq -r '.[0].url')
```

Ship:
```sh
DEPLOY_URL=$(vercel --prod --yes --cwd apps/web | tail -n1)
echo "$DEPLOY_URL"
```

Wait for deployment `READY`:
```sh
vercel inspect "$DEPLOY_URL" --wait
```

## 5. Smoke tests

### Health
```sh
curl -fsS "$DEPLOY_URL/api/health" | jq -e '.ok == true'
curl -fsS "$DEPLOY_URL/api/inngest" | jq -e '.functions | length > 0'
```

### Playwright prod config
```sh
PLAYWRIGHT_BASE_URL="$DEPLOY_URL" pnpm exec playwright test \
  --config=e2e/playwright.prod.config.ts \
  --grep "@smoke|auth|invite|billing-webhook"
```

Required specs: auth sign-in, invite accept flow, Stripe webhook end-to-end (checkout -> subscription active).

## 6. Rollback (triggered on any smoke failure)

```sh
vercel rollback "$PREV_DEPLOY" --yes
curl -fsS "$PREV_DEPLOY/api/health" | jq -e '.ok == true'
```

Also revert aliases if custom domain was already flipped:
```sh
vercel alias set "$PREV_DEPLOY" carelog.app
```

## 7. Reporting

Emit a final checklist. Each phase is PASS / FAIL / SKIPPED with a one-line detail.

```
Carelog Production Ship — <git sha>
[PASS] Preflight      typecheck, test, lint, pgTAP green
[PASS] Env            all Vercel keys present; Stripe webhook live; Resend verified
[PASS] Domain/email   carelog.app valid; resend domain verified
[PASS] Deploy         https://<deploy-url> READY
[PASS] Smoke          health + playwright prod (auth/invite/billing) green
[----] Rollback       not triggered
Result: SHIPPED
```

On failure, set `Result: ROLLED BACK` (or `ABORTED` if failure was pre-deploy) and include the failing command's tail output.

## Invariants

- Never skip phases. Never `--force`. Never edit env in-flight.
- Abort immediately on `SUPABASE_SERVICE_ROLE_KEY` diff between local and Vercel.
- Do not deploy if `supabase migration list --linked` shows unpushed migrations.
- Do not deploy from branches other than `main` unless operator passes `--allow-branch`.
