# Carelog — Environment Variables Reference

Flat reference for every env var in the project. Use this when setting up a new environment or debugging missing variables. For how to obtain each value, see the corresponding section of [`THIRD_PARTY_SETUP.md`](./THIRD_PARTY_SETUP.md).

**Groups:**
- [Supabase](#supabase)
- [App URL](#app-url)
- [Inngest](#inngest)
- [Resend](#resend)
- [Upstash Redis](#upstash-redis)
- [Stripe](#stripe)
- [Sentry](#sentry)
- [PostHog](#posthog)
- [VAPID (web push)](#vapid-web-push)
- [Anthropic](#anthropic)
- [Expo / Mobile](#expo--mobile)
- [CI / GitHub Secrets](#ci--github-secrets)

**Columns:**
- **Used by**: `web` = Next.js app, `mobile` = Expo app, `CI` = GitHub Actions, `Inngest` = background jobs
- **Required**: `required` = app won't start without it; `optional` = feature degrades gracefully; `build-time` = only needed during CI/build, not at runtime
- **Where to set**: `local` = `apps/web/.env.local`; `Vercel` = Vercel project env vars; `EAS` = EAS secrets (`eas secret:create`); `GH Secret` = GitHub repo secret

---

## Supabase

| Variable | Used by | Required | Where to set | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | web | required | local, Vercel | `http://127.0.0.1:54321` locally; cloud URL in production. Auto-set by Vercel ↔ Supabase integration. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | required | local, Vercel | Public anon key — safe for client bundles. Auto-set by integration. |
| `SUPABASE_SERVICE_ROLE_KEY` | web (server) | required | local, Vercel | **Never expose to client.** Server-side only. |
| `EXPO_PUBLIC_SUPABASE_URL` | mobile | required | local (`apps/mobile/.env.local`), EAS | Same cloud URL as web in production. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | mobile | required | local, EAS | Same anon key as web. |

**Source:** Supabase project → Settings → API. Locally: output of `supabase start`.
See THIRD_PARTY_SETUP.md §1.

---

## App URL

| Variable | Used by | Required | Where to set | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | web | required | local, Vercel | `http://localhost:3000` locally; `https://care-log.org` in production. Used for redirect URLs, invite links, AASA host verification. |

---

## Inngest

| Variable | Used by | Required | Where to set | Notes |
|---|---|---|---|---|
| `INNGEST_EVENT_KEY` | web (server), Inngest | required | local, Vercel | Authenticates `inngest.send()` calls from the app to Inngest cloud. |
| `INNGEST_SIGNING_KEY` | web (server), Inngest | required | local, Vercel | Verifies Inngest → app webhook payloads. Prevents spoofed job triggers. |

**Source:** Inngest dashboard → app → Keys.
See THIRD_PARTY_SETUP.md §3.

---

## Resend

| Variable | Used by | Required | Where to set | Notes |
|---|---|---|---|---|
| `RESEND_API_KEY` | web (server) | required | local, Vercel | Authenticates Resend API calls for transactional email. |
| `RESEND_FROM_EMAIL` | web (server) | required | local, Vercel | Default: `digest@care-log.org`. Must use a Resend-verified domain. |

**Source:** Resend dashboard → API Keys.
See THIRD_PARTY_SETUP.md §4.

---

## Upstash Redis

| Variable | Used by | Required | Where to set | Notes |
|---|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` | web (server) | required | local, Vercel | REST endpoint for rate-limiting OTP requests. |
| `UPSTASH_REDIS_REST_TOKEN` | web (server) | required | local, Vercel | Auth token for Upstash REST API. |

**Source:** Upstash console → database → REST API.
See THIRD_PARTY_SETUP.md §5.

---

## Stripe

| Variable | Used by | Required | Where to set | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | web (client) | required | local, Vercel | Safe for client bundles. Use live-mode key in production. |
| `STRIPE_SECRET_KEY` | web (server) | required | local, Vercel | **Never expose to client.** Use live-mode key in production. |
| `STRIPE_WEBHOOK_SECRET` | web (server) | required | local, Vercel | Validates Stripe → app webhook payloads. Obtain from Stripe webhook endpoint registration. |
| `STRIPE_PRICE_MONTHLY` | web (server) | required | local, Vercel | Stripe Price ID for the $14/mo plan (e.g. `price_...`). |
| `STRIPE_PRICE_ANNUAL` | web (server) | required | local, Vercel | Stripe Price ID for the $120/yr plan (e.g. `price_...`). |

**Source:** Stripe dashboard → Developers → API keys (publishable + secret). Webhook secret from Stripe → Webhooks → endpoint detail. Price IDs from Stripe → Products.
See THIRD_PARTY_SETUP.md §6.

---

## Sentry

| Variable | Used by | Required | Where to set | Notes |
|---|---|---|---|---|
| `SENTRY_DSN` | web (client + server) | required | local, Vercel | Data Source Name — routes error events to the correct Sentry project. |
| `SENTRY_AUTH_TOKEN` | web (build-time) | build-time | Vercel (Production env only) | Uploads source maps during `next build`. Set in Vercel → Environment Variables → Production only. Not needed locally. |
| `SENTRY_ORG` | mobile (build-time) | build-time | EAS, Vercel | Sentry organization slug (from `app.config.ts`). |
| `SENTRY_PROJECT` | mobile (build-time) | build-time | EAS, Vercel | Sentry project slug. |

**Source:** Sentry → project → Settings → Client Keys (DSN). Auth token: Sentry → Settings → Auth Tokens → Create with scopes `project:releases`, `org:read`.
See THIRD_PARTY_SETUP.md §7.

---

## PostHog

| Variable | Used by | Required | Where to set | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | web (client) | required | local, Vercel | Project API key. Safe for client bundles. |
| `NEXT_PUBLIC_POSTHOG_HOST` | web (client) | required | local, Vercel | Default: `https://us.i.posthog.com` |

**PHI rule:** `posthog.identify()` and `posthog.capture()` must use UUID only — never email, name, or any PII.
**Source:** PostHog → project → Project Settings → Project API Key.
See THIRD_PARTY_SETUP.md §8.

---

## VAPID (web push)

| Variable | Used by | Required | Where to set | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | web (client) | required | local, Vercel | Public half of the VAPID key pair. Safe for client bundles. |
| `VAPID_PRIVATE_KEY` | web (server) | required | local, Vercel | **Never expose to client.** |
| `VAPID_EMAIL` | web (server) | required | local, Vercel | Default: `admin@caresync.app`. Contact email in VAPID headers. |

**Generate once** (never rotate without re-subscribing all users):
```bash
npx web-push generate-vapid-keys
```
See THIRD_PARTY_SETUP.md §9.

---

## Anthropic

| Variable | Used by | Required | Where to set | Notes |
|---|---|---|---|---|
| `ANTHROPIC_API_KEY` | web (server), CI | required | local, Vercel, GH Secret | Runtime: AI brief generation. CI: `ai-review` job on every PR. Two separate keys are fine — one for app, one for CI. |

**Source:** https://console.anthropic.com/settings/keys
See CI_HEALTH.md §2 for the GitHub secret. For the runtime Vercel key, see THIRD_PARTY_SETUP.md §2.

---

## Expo / Mobile

| Variable | Used by | Required | Where to set | Notes |
|---|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | mobile | required | `apps/mobile/.env.local`, EAS | See Supabase block above. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | mobile | required | `apps/mobile/.env.local`, EAS | See Supabase block above. |
| `FCM_SERVER_KEY` | EAS (Android build) | required | EAS secret | Firebase Cloud Messaging server key. Set via `eas secret:create`. |

**Source:** Firebase console → Project Settings → Cloud Messaging.
See THIRD_PARTY_SETUP.md §10 and MOBILE_SETUP.md.

---

## CI / GitHub Secrets

These live in GitHub → repo → Settings → Secrets and variables → Actions.

| Secret name | Used by | Required | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | CI (`ai-review` job) | required | Gates AI security review on every PR. Without it, the `ai-review` job fails and blocks merge. |

**Source:** https://console.anthropic.com/settings/keys
See CI_HEALTH.md §2.

---

## Future / optional variables

| Variable | Used by | Status | Notes |
|---|---|---|---|
| `OCR_API_KEY` | web (server) | optional (Phase 3) | Prescription scan feature — not yet built. |

---

## Local vs. production summary

| Environment | File / location | How to populate |
|---|---|---|
| Local dev | `apps/web/.env.local` | `cp apps/web/.env.example apps/web/.env.local` then fill manually |
| Local dev (mobile) | `apps/mobile/.env.local` | `cp apps/mobile/.env.example apps/mobile/.env.local` then fill manually |
| Vercel (all envs) | Vercel → Project → Settings → Environment Variables | Add each var; use `vercel env pull` to sync back to local |
| EAS (mobile builds) | `eas secret:create --scope project` | One secret per var; reference from `eas.json` |
| GitHub Actions | Repository secrets | Only `ANTHROPIC_API_KEY` currently needed |

**Tip:** After setting vars in Vercel, run `vercel env pull apps/web/.env.local` to sync the full set to your local file without manually copying each one.
