# Manual work to clear before the weekly limit resets

A focused checklist of operator-only tasks pulled from `BACKLOG.md` §1 that need a human in a third-party dashboard (Supabase, Stripe, Vercel, Inngest) — **none of these need Claude coding capacity**, so they're ideal while waiting for the weekly limit reset. Total time budget: ~2 hours if you do everything.

Picked deliberately to avoid in-progress work — every item below is a `🟢 Ready` row at session start (2026-05-18) and is dashboard/config-only, not code.

> Note: After each item, write the resolution back into the matching `BACKLOG.md` row in your next session — or let `/backlog-sync` pick up the change from git log once you commit the verification artifact.

## 1. Prerequisites

- [ ] Logged into Supabase dashboard for the carelog project ([Supabase](https://supabase.com/dashboard))
- [ ] Logged into Stripe dashboard ([Stripe](https://dashboard.stripe.com))
- [ ] Logged into Vercel dashboard for project `carelog` ([Vercel](https://vercel.com/bradygrapentines-projects/carelog))
- [ ] Logged into Inngest dashboard ([Inngest](https://app.inngest.com))
- [ ] Stripe CLI installed locally — `stripe --version` prints ≥ 1.x

```bash
stripe --version
```

> Watch: This runbook handles secrets indirectly (webhook secrets, env vars). Never paste actual key values into shell history, runbook checkboxes, or commit messages. Reference by env var name only.

## 2. TD-160 — Verify Stripe webhook secret rotation actually took (~5 min · P2)

Cowork couldn't verify the post-SEC-001 rotation: Stripe MCP doesn't expose `/v1/events`; dashboard blocked by Chrome safety; account is empty so no recent deliveries. Confirm manually.

- [ ] Open [Stripe Webhooks → care-log.org/api/stripe/webhook](https://dashboard.stripe.com/webhooks) and scroll to **Attempts**

- [ ] If the Attempts list is empty (likely, since Stripe Checkout isn't wired up yet), trigger a test event from local Stripe CLI:

```bash
stripe trigger invoke.payment_succeeded
```

- [ ] Check Stripe Dashboard → Webhooks → Attempts for the most recent delivery. **200 OK = rotation succeeded.** **400 = rotation didn't take and `STRIPE_WEBHOOK_SECRET` in Vercel needs re-paste.**

- [ ] If 400: open [Vercel env vars](https://vercel.com/bradygrapentines-projects/carelog/settings/environment-variables), locate `STRIPE_WEBHOOK_SECRET` in Production scope, replace with the value from Stripe Dashboard → Webhooks → endpoint → **Signing secret**, redeploy

> Watch: If you see 401 (not 400), it's an auth issue with the test, not the rotation. Skip — only 400 means rotation failed.

## 3. TD-161 — Delete stray Stripe CLI test products (~5 min · P3)

Two test-mode products both named "myproduct" cluttering the Products list. Harmless but ugly. Created during pre-launch Stripe CLI testing.

- [ ] In Stripe dashboard, toggle to **Test mode** (top-right)

- [ ] Navigate to [Products](https://dashboard.stripe.com/test/products) — confirm the two "myproduct" entries exist with IDs `prod_URGgNaNkicIb2X` and `prod_URGfzM4RzfC0A0`

- [ ] For each: click into the product → **Prices** section → verify no active prices are tied to live subscriptions (test-mode prices only)

- [ ] Click **⋯ → Archive product** for each (Stripe disallows hard delete on products that ever had a price; archive is the canonical action)

> Tip: Easier path — `stripe products update prod_URGgNaNkicIb2X --active=false` from the CLI archives without dashboard clicks.

## 4. TD-156 — Align Supabase Auth email subjects (~10 min · P3)

New users get `"Confirm Your Signup"`, existing users get `"Your Magic Link"`. Practical exploit value nil but worth standardizing for clean threat model.

- [ ] Open [Supabase → Authentication → Email Templates](https://supabase.com/dashboard/project/_/auth/templates) for the carelog project

- [ ] Edit the **"Confirm Signup"** template → set Subject to: `Your CareSync sign-in code`

- [ ] Edit the **"Magic Link"** template → set Subject to: `Your CareSync sign-in code`

- [ ] Save both. Verify by signing up with a fresh email + signing in with an existing email; both inbox subjects should now match.

> Note: Body copy can stay slightly different (signup vs sign-in language) — only the Subject line needs alignment to close the enumeration vector.

## 5. TD-158 — Tighten PostgREST schema-suggestion leak (~15 min · P3)

Authenticated users querying a non-existent table get back a `404 PGRST205` with body `"Perhaps you meant the table 'public.care_recipients'"` — free schema introspection. Low severity, but worth confirming config is tight.

- [ ] Open [Supabase → Settings → API](https://supabase.com/dashboard/project/_/settings/api)

- [ ] Under **API Settings**, find **Exposed schemas** (also called "Schema") — confirm value is `public` only. If anything else is listed (e.g. `extensions`, `graphql_public` beyond defaults), narrow to `public` unless intentionally exposed.

- [ ] Under **Extra search path** confirm `public, extensions` (Supabase default) — anything else should be deliberate

- [ ] Capture a screenshot of the panel for the audit log — save to `docs/runbooks/screenshots/2026-05-18-td-158-postgrest-config.png` next session

> Watch: Do NOT remove `extensions` from search path — pgcrypto/uuid extensions live there and Supabase tooling depends on it.

## 6. TD-146 §3 — Operator-verify per-function 24h cron firing counts (~10 min · P3 follow-up)

The source-level audit shipped in PR #559; the runtime verification was deferred. Confirm the projection (~388 firings/24h ≈ 23% of Hobby quota) matches actuals before deciding on the Inngest-vs-Queues migration (TD-133/ON-70/ON-71).

- [ ] Open [Inngest → Functions](https://app.inngest.com) (project carelog)

- [ ] For each function, click in → **Runs** tab → filter to **Last 24 hours** → record the count

| Function | Cadence | Expected/24h | Actual |
|---|---|---|---|
| `rateLimit429Monitor` | 5 min | 288 | |
| `shiftTradeExpiry` | 15 min | 96 | |
| `weeklyDigest` | weekly | ≤1 | |
| `inviteExpiryReaper` | hourly | 24 | |
| `medicationReminder` | hourly | 24 | |
| `careEventDigest` | daily | 1 | |
| `consentExpiryReaper` | daily | 1 | |
| `subscriptionStateRefresh` | daily | 1 | |

- [ ] Write the totals into `docs/research/2026-05-17-td-146-inngest-cron-audit.md` §6.8 (new section) with date stamp + dashboard run-ids

- [ ] If actuals deviate >20% from projection: flag in BACKLOG.md as a new TD row (unexpected cron behavior) before proceeding with Queues migration scoping

> Tip: Inngest's "Runs" view shows the full firing log including no-op runs — that's the right count, not the "Successful runs" filter which excludes guarded early-returns.

## 7. SEC-009 — Populate Vercel Development env tier (~30 min · P2)

Mitigates SEC-001 root cause permanently. After this lands, `vercel env pull` from a fresh checkout returns local-safe values instead of production secrets. Operator walkthrough lives in `docs/project-info/runbooks/SECRETS_ROTATION-runbook.md` §9.

- [ ] Open [Vercel → carelog → Settings → Environment Variables](https://vercel.com/bradygrapentines-projects/carelog/settings/environment-variables)

- [ ] For each variable below, click **Add** (or edit existing) and add a **Development**-scoped value pointing at local Supabase / test Stripe:

| Variable | Development value source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `supabase status -o env` → ANON_KEY |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase status -o env` → SERVICE_ROLE_KEY |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe test-mode publishable |
| `STRIPE_SECRET_KEY` | Stripe test-mode secret |
| `STRIPE_PRICE_MONTHLY` | Stripe test-mode price ID |
| `STRIPE_PRICE_ANNUAL` | Stripe test-mode price ID |
| `STRIPE_WEBHOOK_SECRET` | Stripe CLI `stripe listen` whsec_* |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | dev keypair (re-use or `web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | dev keypair private half |
| `VAPID_EMAIL` | your email |
| `SENTRY_DSN` | leave blank (dev = no Sentry) |
| `SENTRY_ORG` | leave blank |
| `SENTRY_PROJECT` | leave blank |

- [ ] Verify the pull works:

```bash
cd ~/projects/carelog && vercel env pull --environment=development apps/web/.env.local.test
```

- [ ] Diff the test pull against your current `.env.local` — should be functionally equivalent, no production secrets present

```bash
diff <(sort apps/web/.env.local) <(sort apps/web/.env.local.test) | head -30
```

- [ ] Delete the test pull: `rm apps/web/.env.local.test`

> Watch: `STRIPE_WEBHOOK_SECRET` for dev should be the local Stripe CLI signing secret (`whsec_*`), NOT the production webhook secret. Wrong value here = local webhook handler rejects every event from `stripe trigger`.

## 8. TD-177 — Confirm dev env pull works from clean checkout (~10 min · P3 verification)

Validates §7 above. Different angle: simulates a teammate's first-machine bootstrap.

- [ ] In a scratch directory, clone fresh:

```bash
cd /tmp && rm -rf carelog-bootstrap-test && git clone git@github.com:bradygrapentine/carelog.git carelog-bootstrap-test && cd carelog-bootstrap-test
```

- [ ] Run the dev env pull:

```bash
vercel link --yes && vercel env pull --environment=development apps/web/.env.local
```

- [ ] Confirm the pulled file has all expected keys — count should be ≥ 14:

```bash
grep -c '=' apps/web/.env.local
```

- [ ] If count is below 14, return to §7 and verify each variable has a **Development** scope checkbox (not just Production/Preview)

- [ ] Clean up: `cd /tmp && rm -rf carelog-bootstrap-test`

## 9. TD-157 — Repro spike: does fresh OTP revoke existing sessions? (~20 min · P2 spike)

Read-only investigation. Cowork's earlier signal was inconclusive due to tab-switching noise. Doc actual behavior; if reproducible, file as bug-fix follow-up.

- [ ] Sign in with `brady.grapentine@gmail.com` in **Tab A** (Chrome). Verify `/dashboard` renders. Leave the tab idle.

- [ ] In a separate Chrome window or Firefox session (**Tab B**), open `/signin` and request a fresh OTP for `brady.grapentine@gmail.com`. **Do not** complete the sign-in — just trigger the request.

- [ ] **Immediately** in Tab A (no human-driven switches between tabs), reload `/dashboard`. Record:
  - [ ] Was Tab A redirected to `/signin`? (yes / no)
  - [ ] Did Tab A's cookies for `sb-access-token` survive?
  - [ ] Did Tab A's session in Supabase → Authentication → **Users** → brady's row → Sessions list still exist?

- [ ] Repeat 2 more times for reliability (3 runs total)

- [ ] Document findings in `docs/research/2026-05-18-td-157-otp-session-revoke-spike.md` with the 3 trial results and Supabase session-id evidence

- [ ] If sessions ARE being revoked: open a new bug row (`TD-XXX`) in BACKLOG.md §1 with severity Medium, attach the research note

> Note: Supabase's default is `JWT_EXPIRY=3600` and refresh tokens are rotated, not revoked, on new OTP issuance. If behavior diverges from that, it's likely a custom hook or a recent Supabase Auth update — worth reading the [Supabase auth changelog](https://github.com/supabase/auth/releases) for anything in the last 60 days touching `signInWithOtp`.

## 10. ON-75 — Verify production onboarding wizard creates org successfully (~15 min · P2 verification)

Resolution was traced to a misconfigured local `.env.local` (production `sb_secret_*` key in a JWT-only local env). Local fix shipped. Production has never been verified.

- [ ] Open a fresh incognito window → https://care-log.org

- [ ] Sign up with a brand-new email (use a `+test`-aliased Gmail: `grapentineb+caresync-verify@gmail.com`)

- [ ] Run through the onboarding wizard. At the "create care team" step, watch for any `Error: Org creation failed` toast.

- [ ] Verify in Supabase prod → **Table editor** → `organizations` → a new row exists with `created_by` matching the new user's id

- [ ] Verify in `memberships` table → a row exists with `role='coordinator'`, `org_id` matching the new org, `user_id` matching the new user, `accepted_at IS NOT NULL`

- [ ] If row creation succeeded: flip ON-75 in BACKLOG.md from `🟡 Pending verification` to ✅ Shipped (next session) with the verification timestamp

- [ ] If row creation FAILED: this becomes a real RLS gap. Capture the exact error from Sentry + browser DevTools console, file as a P1 critical bug, do not ship anything until fixed.

- [ ] **Cleanup:** after verification, delete the test user via Supabase Authentication → Users → ⋯ → Delete user — leaves no stale test data in prod

> Watch: Do NOT use your real `brady.grapentine@gmail.com` account for this test — it already has an org. The bug only reproduces on a NEW user's first org creation. Use a `+test` alias.

## 11. Verification — wrap-up checklist

- [ ] Every item in §2–§10 either completed or explicitly skipped with a one-line reason in this checklist
- [ ] Findings for §6 (Inngest counts) and §9 (OTP spike) written to `docs/research/`
- [ ] Production verification §10 has a clear ✅ or 🔴 outcome with evidence
- [ ] One-line summary written for next session's `/backlog-sync` to find (e.g. as a git-tracked note under `.claude/notes/2026-05-18-manual-sweep-summary.md` if desired)

> Tip: Once the weekly limit resets, the first session should start with `/backlog-sync` so the resolutions above land in BACKLOG.md before any new work picks up.
