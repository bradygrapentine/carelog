# SECRETS_ROTATION.md

Runbook for rotating production secrets and managing the local Supabase service-role key. Sourced from SEC-001 (BACKLOG, 2026-05-10).

---

## Background — what triggered this runbook

On 2026-05-10, while diagnosing ON-75 (care-team creation failing locally), the local `apps/web/.env.local` was discovered to contain a full set of **production** secrets pulled by `vercel env pull`. The file's auto-generated header (`# Created by Vercel CLI`) and the prod-format `sb_secret_*` value for `SUPABASE_SERVICE_ROLE_KEY` confirmed it. Plaintext production secrets on developer disk are a P0 incident even if `.env.local` is git-ignored — disk backups, IDE indexers, and accidental sharing all become exposure paths.

The fix is two-step:

1. **Rotate every secret in the file** (dashboard rotations + Vercel env updates + redeploy).
2. **Use the local-development env going forward** so future `vercel env pull` runs grab dev-tier secrets, not prod.

---

## Part 1 — SEC-001: rotate all leaked production secrets

The 6 secrets that landed in plaintext on disk:

| Variable | Service | Where to rotate |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Project Settings → API → "Reset" the service role key |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Dashboard → Developers → Webhooks → endpoint → "Roll signing secret" |
| `RESEND_API_KEY` | Resend | Dashboard → API keys → revoke + reissue |
| `INNGEST_SIGNING_KEY` | Inngest | Dashboard → Apps / Settings → roll signing key |
| `INNGEST_EVENT_KEY` | Inngest | Same dashboard → roll event key |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash | Dashboard → Database → "Reset" REST token |

`VERCEL_OIDC_TOKEN` rotates itself (short-lived JWT issued per environment). No action.

### Procedure

For each secret above:

1. **Rotate in source dashboard.** Capture the new value securely (1Password, password manager, OS keychain — never plaintext file).
2. **Update Vercel** (`Production` environment only):
   - Web UI: Project → Settings → Environment Variables → find variable → Edit → paste new value → Save.
   - Or CLI: `vercel env rm <NAME> production && vercel env add <NAME> production` (paste new value when prompted).
3. **Redeploy production** so the new secret takes effect:
   - Web UI: Deployments → most recent production → Redeploy.
   - Or CLI: `vercel --prod`.
4. **Verify** the relying surface still works:
   - Supabase service role: hit any RLS-bypassing endpoint (e.g. `/api/onboarding/create` after a fresh signup) and confirm 200.
   - Stripe webhook: trigger a test event from the Stripe dashboard → confirm webhook handler returns 200.
   - Resend: send a test transactional email (e.g. magic link) → confirm delivery.
   - Inngest: trigger any background job → confirm Inngest dashboard shows successful run.
   - Upstash: hit any rate-limited endpoint → confirm 200 + rate-limit header increments.
5. **Confirm the OLD secret is dead.** For Stripe webhook secret specifically, requests signed with the old secret should now fail signature verification. Test by sending a request with a stale signature → expect 400.

Order matters for Stripe: roll the webhook secret last and verify the redeployed function picks up the new secret BEFORE the next real webhook fires (Stripe retries on 400s, but you want to avoid the noise window). Schedule the rotation when traffic is lowest if possible.

### Checklist (copy to PR or session notes)

```
[ ] SUPABASE_SERVICE_ROLE_KEY rotated in Supabase dashboard
[ ] SUPABASE_SERVICE_ROLE_KEY updated in Vercel (production)
[ ] Redeployed; /api/onboarding/create verified 200
[ ] STRIPE_WEBHOOK_SECRET rolled in Stripe dashboard
[ ] STRIPE_WEBHOOK_SECRET updated in Vercel (production)
[ ] Redeployed; webhook test event verified 200
[ ] RESEND_API_KEY revoked + reissued in Resend dashboard
[ ] RESEND_API_KEY updated in Vercel (production)
[ ] Redeployed; magic-link delivery verified
[ ] INNGEST_SIGNING_KEY rolled in Inngest dashboard
[ ] INNGEST_EVENT_KEY rolled in Inngest dashboard
[ ] Both updated in Vercel (production); redeployed; Inngest run verified
[ ] UPSTASH_REDIS_REST_TOKEN reset in Upstash dashboard
[ ] UPSTASH_REDIS_REST_TOKEN updated in Vercel (production); rate limit verified
[ ] Local apps/web/.env.local replaced with dev-tier values (Part 3)
[ ] BACKLOG SEC-001 row flipped to ✅ Shipped via /backlog-sync
```

### Git history scrub (only if a secret was ever committed)

`apps/web/.env.local` is git-ignored, so the secrets should never have entered git. To confirm:

```sh
git log --all --full-history --source -- apps/web/.env.local
git log --all -p -S "sb_secret_NBtixZ" 2>/dev/null  # search for the leaked prefix
git log --all -p -S "signkey-prod-" 2>/dev/null
```

If any output: scrub via `git filter-repo` or `git filter-branch` and force-push (coordinate with collaborators first). If output is empty: nothing to scrub.

---

## Part 2 — Local Supabase service-role JWT (developer environment)

Local Supabase ships with deterministic demo JWTs for the `anon` and `service_role` roles. They're known-public values (literally documented on supabase.com/docs/guides/cli/local-development) and are SAFE to put in `apps/web/.env.local` because:

- They only grant access to your local Supabase Docker stack on `127.0.0.1:54321`.
- They never validate against the production Supabase API.
- They're identical for every developer running `supabase start`.

### How to fetch the local values

```sh
supabase status -o env
```

Output includes:

```
ANON_KEY="<JWT — role: anon, iss: supabase-demo>"
SERVICE_ROLE_KEY="<JWT — role: service_role, iss: supabase-demo>"
API_URL="http://127.0.0.1:54321"
```

The JWTs themselves are constant across every local Supabase install (`iss: supabase-demo`, `exp: 1983-...`) — they're shipped in `@supabase/cli` so every developer's local stack issues the same pair. They are NOT secrets, but we don't keep their literal values in this repo to keep the gitleaks scanner clean. To get them, run `supabase status -o env` and copy the `ANON_KEY` and `SERVICE_ROLE_KEY` lines verbatim.

### Symptom that means your local key is wrong

If `apps/web/.env.local`'s `SUPABASE_SERVICE_ROLE_KEY` does NOT begin with `eyJ` (JWT prefix), it's a production-style key and `supabaseAdmin` will silently fall back to the anon role. Symptom in dev:

```
[onboarding] error: Error: Org creation failed: new row violates row-level security policy for table "organizations"
POST /api/onboarding/create 500
```

That error is RLS doing the right thing — the issue is upstream: the admin client wasn't actually admin.

### Fix

Edit `apps/web/.env.local`, locate the `SUPABASE_SERVICE_ROLE_KEY=` line, replace its value with the JWT above. Restart `pnpm web` so Next.js re-reads env. Care-team creation will work.

---

## Part 3 — Going forward: local dev secrets, not prod

The root cause of SEC-001 was running `vercel env pull` without specifying the environment. By default it pulls Production. Preferred:

```sh
# in apps/web/
vercel env pull --environment=development .env.local
```

This pulls the `Development` environment's variables, which should be local-tier only (local Supabase JWT, dev Stripe keys, no prod webhook secrets). If your Vercel project doesn't have a Development environment populated:

1. Vercel dashboard → Project → Settings → Environment Variables.
2. For each variable, add a "Development" override with the local-tier value.
3. Future `vercel env pull --environment=development` reads those overrides.

**Add to your shell profile** (zsh):

```sh
alias vepull='vercel env pull --environment=development .env.local'
```

So `vepull` from `apps/web/` always grabs dev-tier values.

### Vercel CLI refresher

The Vercel CLI is currently on a stale version (53.2.0). Recommend `npm i -g vercel@latest` for latest agentic features and bug fixes.

---

## Related

- BACKLOG row **SEC-001** — tracking for rotation completion.
- BACKLOG row **ON-75** — root cause was the leaked-prod-key situation; tracked here.
- `docs/project-info/technology/SECURITY_MODEL.md` — service-role isolation rules.
- ADR-0001 (`docs/adr/0001-phi-anonymous-uuid-only.md`) — analytics PHI invariant (separate concern but in the same security domain).
