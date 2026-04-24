# Carelog — Deployment Runbook

Step-by-step guide for every production deployment. Web deploys are fully automated (push to `main` → Vercel deploys). Database migrations and mobile builds require manual steps.

**Related docs:**
- [`THIRD_PARTY_SETUP.md`](./THIRD_PARTY_SETUP.md) — first-time service account setup
- [`CI_HEALTH.md`](./CI_HEALTH.md) — GitHub Actions health
- [`MOBILE_SETUP.md`](./MOBILE_SETUP.md) — mobile build details
- [`ENV_VARS.md`](./ENV_VARS.md) — env var reference

---

## Table of Contents

- [§1 Pre-flight checklist](#1-pre-flight-checklist)
- [§2 Web deploy (Vercel)](#2-web-deploy-vercel)
- [§3 Database migrations](#3-database-migrations)
- [§4 Mobile deploy (EAS)](#4-mobile-deploy-eas)
- [§5 Post-deploy verification](#5-post-deploy-verification)
- [§6 Rollback procedures](#6-rollback-procedures)
- [§7 Headless QA scripts](#7-headless-qa-scripts)

---

## 1. Pre-flight checklist

Run before every deploy that changes user-facing behavior.

### Code quality
```bash
cd apps/web && npx tsc --noEmit          # typecheck
pnpm lint                                 # ESLint + contrast audit
pnpm test                                 # Vitest unit tests
cd apps/web && npx vitest run            # full web test suite (~961 tests)
supabase test db                          # pgTAP RLS tests
pnpm exec playwright test                 # E2E
```

All must exit 0 before pushing to `main`.

### Backlog and env vars
- [ ] BACKLOG.md stories for this deploy are `🔎 In review` (not just `🟢 Ready`)
- [ ] Vercel env vars confirmed — run `vercel env pull apps/web/.env.local` and check for any blanks
- [ ] If migrations are included: reviewed for destructive ops (`DROP COLUMN`, `DROP TABLE`, `TRUNCATE`)
- [ ] PR has been reviewed (run `/review` if touching auth/RLS/PHI)

---

## 2. Web deploy (Vercel)

### Normal deploy

Push to `main` → Vercel deploys automatically. No manual action needed.

```bash
git push origin main
```

**How to verify:**
1. [vercel.com](https://vercel.com) → project → Deployments → confirm latest deployment is green
2. https://care-log.org — page loads, no console errors
3. OTP sign-in works end-to-end
4. Check Sentry → Releases — new release appears with source maps attached

**Expected time:** ~2–4 minutes for Vercel to build and deploy.

### Manual / emergency deploy

```bash
vercel --prod   # deploys current HEAD to production; prompts for confirmation
```

### Check deploy status

```bash
vercel ls                     # list recent deployments
vercel inspect <deploy-url>   # inspect a specific deployment
```

---

## 3. Database migrations

Migrations run against local Supabase automatically. Pushing to cloud requires a manual step.

### Before running migrations against cloud

1. **Link to the cloud project** (one-time per machine):
   ```bash
   supabase link --project-ref <your-project-ref>
   # Project ref: Supabase dashboard → project → Settings → General → Reference ID
   ```

2. **Review the diff** before pushing:
   ```bash
   supabase db diff --linked
   ```

3. **Check for destructive operations:**
   ```bash
   grep -i "drop\|truncate\|alter.*drop" supabase/migrations/*.sql
   ```
   Any `DROP COLUMN`, `DROP TABLE`, or `TRUNCATE` requires a data-migration plan. Never drop a column that's still referenced in code.

### Apply migrations to cloud

```bash
supabase db push
```

**How to verify:**
```bash
# Confirm schema matches local
supabase db diff --linked
# Should output nothing (empty diff = in sync)

# Run pgTAP against cloud
supabase test db --linked
```

### Safety rules

- Never run `supabase db reset` against the linked cloud project — it drops and rebuilds the entire database.
- Always take a Supabase backup before a migration that touches existing data: Supabase dashboard → project → Database → Backups → Create backup.
- RLS policies must be reviewed before any migration that adds tables or changes `auth.users` joins — run `/review` or use the `rls-reviewer` agent.

---

## 4. Mobile deploy (EAS)

Mobile builds and submissions are **interactive** — Claude cannot run them. You must run these commands manually.

### Build

```bash
# iOS production build (uploads to TestFlight automatically)
eas build --platform ios --profile production --auto-submit

# Android production build (uploads to Play Store automatically)
eas build --platform android --profile production --auto-submit

# Both platforms
eas build --platform all --profile production --auto-submit
```

`--auto-submit` requires App Store Connect and Play Store credentials set up via `eas submit --help`.

### Submit (if not using --auto-submit)

```bash
eas submit --platform ios --latest
eas submit --platform android --latest
```

### Write release notes

Before submitting, update release notes:
- App Store Connect → app → TestFlight or App Store → version → "What's New"
- Play Store Console → app → Release → create release → release notes

### How to verify

- **iOS:** TestFlight → check that the new build appears; install on test device; smoke test OTP sign-in + core flows
- **Android:** Play Store Console → Internal testing → confirm build processing complete; install on test device

**No rollback for mobile** — see §6.

---

## 5. Post-deploy verification

Run these checks within 15 minutes of a production deploy.

### Automated checks
```bash
# Inngest cron health
curl -s https://care-log.org/api/health/crons | python3 -m json.tool
# Expect: {"status": "ok", "functions": [...]}
```

### Manual checks

| Check | Where | What to look for |
|---|---|---|
| Sentry error rate | sentry.io → project → Issues | No spike of new errors post-deploy |
| Sentry source maps | sentry.io → Releases | Latest release shows source maps attached |
| PostHog events | posthog.com → Live Events | Events arriving with UUID identifiers (not email) |
| Inngest functions | app.inngest.com → functions | All functions synced; no failed runs |
| Vercel logs | vercel.com → project → Logs | No unhandled errors or 5xx spikes |

### Smoke test

1. Sign in via OTP with your test account
2. Create a journal entry
3. View a daily brief (if AI feature is live)
4. Check a subscription flow (Stripe test mode)

---

## 6. Rollback procedures

### Web rollback (~2 min)

Vercel keeps a full history of deployments. To roll back:

1. [vercel.com](https://vercel.com) → project → Deployments
2. Find the last known-good deployment
3. Click the `...` menu → **Promote to Production**

Vercel instantly switches production traffic to the previous deployment. No build needed.

**How to verify:** https://care-log.org loads the old version. Check Vercel → Deployments → the promoted deployment shows "Production" badge.

### Database rollback

Supabase does not support automatic migration rollback. Options:

1. **Write a down migration** manually and run `supabase db push`. Use `ALTER TABLE` to restore columns, `CREATE TABLE` to restore dropped tables.
2. **Restore from backup** — Supabase dashboard → project → Database → Backups → Restore. Note: this restores the entire database to the backup point, losing all data written since.

**Prefer option 1** (down migration) unless the data loss from option 2 is acceptable.

### Mobile rollback

**There is no rollback for mobile apps.** Once a build is submitted to TestFlight or the Play Store:
- **TestFlight:** You can remove the build from TestFlight, but testers who already installed it keep the version. You cannot force-downgrade.
- **Play Store:** You can halt a rollout if using staged rollout, but fully released builds cannot be recalled.

**The only forward path is a patch release.** Bump the version in `app.json`, fix the issue, and submit a new build.

---

## 7. Headless QA scripts

These scripts run Claude Code non-interactively and can be used pre-deploy or post-deploy.

```bash
# Adversarial security review — outputs to reviews/YYYY-MM-DD-security-review.md
./scripts/security-review.sh

# Self-correcting build loop (up to 5 fix cycles)
./scripts/build-fix.sh
```

Run `security-review.sh` before any deploy that touches auth, RLS policies, billing, or PHI-adjacent code. The output is a severity-ranked findings report — review before promoting to production.
