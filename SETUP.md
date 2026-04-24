# Carelog — Setup Guide

The single entry point for getting Carelog running from scratch. Follow this document top-to-bottom on a fresh laptop or fresh GitHub account.

**Time estimate: ~3–4 hours** (mostly waiting on third-party signups and DNS propagation).

---

## Table of Contents

- [§1 Prerequisites](#1-prerequisites) — tooling, exact versions
- [§2 Clone and install](#2-clone-and-install)
- [§3 Local env files](#3-local-env-files)
- [§4 Run locally](#4-run-locally)
- [§5 Third-party services](#5-third-party-services) — human-only clicks
- [§6 CI / GitHub setup](#6-ci--github-setup)
- [§7 Mobile setup](#7-mobile-setup)
- [§8 Production deploy](#8-production-deploy)
- [§9 Master checklist](#9-master-checklist) — copy into a GitHub issue

---

## 1. Prerequisites

Install these before cloning. Exact versions matter.

### Runtime and package manager

| Tool | Required version | Install |
|---|---|---|
| Node.js | `>=22` (`.nvmrc` says 22) | `brew install node@22` or `nvm install 22` |
| pnpm | `>=9.0.0` (`packageManager: pnpm@9.0.0`) | `npm install -g pnpm@9` |
| Docker Desktop | latest stable | https://www.docker.com/products/docker-desktop — **must be running** before `supabase start` |

### CLI tools

```bash
# Supabase CLI (local dev)
brew install supabase/tap/supabase

# GitHub CLI (PR management, secrets)
brew install gh
gh auth login   # INTERACTIVE — run manually, follow browser flow

# EAS CLI (Expo mobile builds)
npm install -g eas-cli

# Playwright Chromium (pre-commit hook dependency)
# Run this after cloning the repo:
cd apps/web && npx playwright install chromium
```

**How to verify:**
```bash
node --version    # v22.x.x
pnpm --version    # 9.x.x
docker info       # shows server version (Docker must be running)
supabase --version
gh --version
eas --version
```

---

## 2. Clone and install

```bash
git clone https://github.com/<your-org>/carelog.git
cd carelog
pnpm install
```

Install Playwright Chromium (required by the pre-commit hook — without it the hook fails on the first commit):

```bash
cd apps/web && npx playwright install chromium && cd ../..
```

**How to verify:** `pnpm test` runs and exits 0.

---

## 3. Local env files

The app uses two `.env.local` files: one for the web app and one for the mobile app.

### Web app (`apps/web/.env.local`)

Copy the example and fill in values:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Local Supabase values come from `supabase start` (see §4). Third-party values come from the service dashboards (see §5). For a complete reference of every variable with source and environment, see [`docs/project-info/runbooks/ENV_VARS.md`](./docs/project-info/runbooks/ENV_VARS.md).

**Minimum viable local set** (enough to reach localhost:3000):
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Mobile app (`apps/mobile/.env.local`)

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
# Fill in:
# EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# EXPO_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
```

---

## 4. Run locally

Docker must be running before this step.

```bash
# Terminal 1 — Supabase local stack
supabase start
# Outputs URL, anon key, service role key — copy into apps/web/.env.local

# Terminal 2 — Next.js web app
pnpm web
# http://localhost:3000

# Terminal 3 — Inngest dev server (optional, needed for background jobs)
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest

# Terminal 4 — Expo mobile (optional)
pnpm mobile
```

**How to verify:** Navigate to http://localhost:3000 and complete an OTP sign-in.

### Full test suite

```bash
pnpm test                    # Vitest unit tests
supabase test db             # pgTAP RLS tests (requires supabase start)
pnpm exec playwright test    # E2E tests
```

---

## 5. Third-party services

These require human sign-up and dashboard configuration. They are all documented in detail in [`docs/project-info/runbooks/THIRD_PARTY_SETUP.md`](./docs/project-info/runbooks/THIRD_PARTY_SETUP.md). Below is the ordered sequence — complete them in this order because some keys feed into others.

**Estimated time: ~2 hours** (most time is DNS propagation for Resend domain verification).

| Order | Service | What you'll do | THIRD_PARTY_SETUP.md section |
|---|---|---|---|
| 1 | Supabase | Create project, copy keys, sign HIPAA BAA | §1 |
| 2 | Vercel | Create project, wire Supabase integration, add all env vars | §2 |
| 3 | Inngest | Create account, copy keys, sync endpoint after first Vercel deploy | §3 |
| 4 | Resend | Create account, verify domain (`care-log.org`), copy API key | §4 |
| 5 | Upstash Redis | Create database, copy URL + token | §5 |
| 6 | Stripe | Create account, add products ($14/mo + $120/yr), register webhook | §6 |
| 7 | Sentry | Create project, copy DSN + auth token, set `SENTRY_AUTH_TOKEN` in Vercel | §7 |
| 8 | PostHog | Create project, copy key, enable privacy settings | §8 |
| 9 | VAPID keys | Generate once locally, add to Vercel | §9 |

For mobile push and deep-link setup, see §7 of this document and [`docs/project-info/runbooks/MOBILE_SETUP.md`](./docs/project-info/runbooks/MOBILE_SETUP.md).

---

## 6. CI / GitHub setup

See [`docs/project-info/runbooks/CI_HEALTH.md`](./docs/project-info/runbooks/CI_HEALTH.md) for the full runbook. Quick summary:

| Task | Where | Time |
|---|---|---|
| Enable GitHub Actions billing (add payment method + spending limit) | github.com → Settings → Billing | ~5 min |
| Add `ANTHROPIC_API_KEY` secret | github.com → repo → Settings → Secrets → Actions | ~2 min |
| Enable "Allow auto-merge" (needed for overnight agents) | github.com → repo → Settings → General → Pull Requests | ~1 min |
| Set branch protection on `main` | github.com → repo → Settings → Branches | ~5 min |

All four are documented with exact URLs and verification steps in `CI_HEALTH.md`.

---

## 7. Mobile setup

See the full runbook: [`docs/project-info/runbooks/MOBILE_SETUP.md`](./docs/project-info/runbooks/MOBILE_SETUP.md).

**Interactive commands you must run manually** (Claude cannot run these):
```bash
eas login              # authenticate with Expo account
eas credentials        # upload APNs .p8 key
eas build              # trigger a build
eas submit             # submit to App Store / Play Store
```

Key facts about the mobile app config:
- Bundle ID (iOS): `com.carelog.app`
- Package (Android): `com.carelog.app`
- Scheme: `yourcarelog`
- Associated domain: `applinks:yourcarelog.com`

---

## 8. Production deploy

See the full runbook: [`docs/project-info/runbooks/DEPLOYMENT.md`](./docs/project-info/runbooks/DEPLOYMENT.md).

Web deploys happen automatically on push to `main` via Vercel. Database migrations require `supabase db push` against the cloud project after `supabase link`. Mobile builds require `eas build --auto-submit` (interactive, run manually).

---

## 9. Master checklist

Copy this into a GitHub issue ("Fresh machine setup") and check off as you go.

### Tooling
- [ ] Node 22 installed
- [ ] pnpm 9 installed
- [ ] Docker Desktop running
- [ ] Supabase CLI installed
- [ ] GitHub CLI installed + `gh auth login` completed
- [ ] EAS CLI installed
- [ ] Playwright Chromium installed (`cd apps/web && npx playwright install chromium`)

### Local
- [ ] `pnpm install` succeeded
- [ ] `supabase start` outputs URL + keys
- [ ] `apps/web/.env.local` filled with local Supabase keys
- [ ] `pnpm web` reaches localhost:3000
- [ ] OTP sign-in works end-to-end
- [ ] `pnpm test` exits 0
- [ ] `supabase test db` exits 0

### Third-party services
- [ ] Supabase cloud project created + HIPAA BAA signed
- [ ] Vercel project created + Supabase integration wired + all env vars set
- [ ] Inngest account + keys set in Vercel; endpoint synced after first deploy
- [ ] Resend account + domain verified + API key in Vercel
- [ ] Upstash Redis created + credentials in Vercel
- [ ] Stripe live-mode account + $14/mo product + webhook registered
- [ ] Sentry DSN in Vercel + `SENTRY_AUTH_TOKEN` in Vercel (Production env)
- [ ] PostHog project + key in Vercel + privacy settings confirmed
- [ ] VAPID keys generated + set in Vercel

### CI / GitHub
- [ ] GitHub Actions billing healthy (payment method + spending limit set)
- [ ] `ANTHROPIC_API_KEY` repo secret added
- [ ] Allow auto-merge enabled
- [ ] Branch protection on `main` configured

### Mobile
- [ ] Apple Developer account active
- [ ] APNs `.p8` key uploaded to EAS credentials
- [ ] Firebase project created + `google-services.json` in EAS
- [ ] `eas login` completed
- [ ] iOS AASA file served at `https://yourcarelog.com/.well-known/apple-app-site-association`
- [ ] Android `assetlinks.json` served + SHA-256 fingerprint from EAS build

### Production
- [ ] `supabase link --project-ref <ref>` completed
- [ ] `supabase db push` ran against cloud — all migrations applied
- [ ] Vercel production deploy green
- [ ] Custom domain resolving + SSL active
- [ ] Sentry receiving events with source maps
- [ ] PostHog receiving events with UUID identifiers (no PII)
- [ ] Inngest weekly digest cron visible in dashboard

---

## Deep-dive docs

| Doc | When to read |
|---|---|
| [`docs/project-info/runbooks/THIRD_PARTY_SETUP.md`](./docs/project-info/runbooks/THIRD_PARTY_SETUP.md) | Full per-service setup (17 sections) |
| [`docs/project-info/runbooks/ENV_VARS.md`](./docs/project-info/runbooks/ENV_VARS.md) | Every env var — name, service, required/optional, where to set |
| [`docs/project-info/runbooks/CI_HEALTH.md`](./docs/project-info/runbooks/CI_HEALTH.md) | GitHub Actions billing, secrets, branch protection |
| [`docs/project-info/runbooks/MOBILE_SETUP.md`](./docs/project-info/runbooks/MOBILE_SETUP.md) | Expo / EAS / APNs / Firebase / deep links |
| [`docs/project-info/runbooks/DEPLOYMENT.md`](./docs/project-info/runbooks/DEPLOYMENT.md) | Production deploy runbook + rollback |
| [`docs/project-info/technology/TROUBLESHOOTING.md`](./docs/project-info/technology/TROUBLESHOOTING.md) | Local dev fixes (Supabase, auth, Turbopack) |
