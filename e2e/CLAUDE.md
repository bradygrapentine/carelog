# E2E Tests — Playwright

## Commands

```sh
pnpm exec playwright test
```

Requires `supabase start` and `pnpm web` (localhost:3000) running first.

## Auth helpers (TD-220)

`signIn(page, email)` and `acceptInviteAsNewUser(page, email)` in `helpers.ts` source
their OTP from `getOtpViaAdmin(email)` — `admin.auth.admin.generateLink({ type: 'magiclink' })`
returns `data.properties.email_otp` **without sending an email**, so there's no Mailpit
round-trip (this killed the recurring `getOtpFromMailpit timed out` flake). The minted
`email_otp` verifies under the UI's `type: 'email'` path — same GoTrue OTP storage class;
do NOT switch the UI verify to `magiclink`.

The admin client needs the **local** service-role key, not the prod `sb_secret_` key. It
reads `E2E_SUPABASE_SERVICE_ROLE_KEY` from env and falls back to the well-known
`supabase start` demo JWT, so CI/local work with no extra config. `getOtpFromMailpit` +
`clearMailpit` are still exported — used only by `auth.spec.ts`'s "real OTP email delivery
(Mailpit coverage path)" test, which keeps the actual email pipeline smoke-covered.

## Tooling

- `chrome-devtools-mcp` plugin — live browser debugging, LCP, a11y audits on the running app
