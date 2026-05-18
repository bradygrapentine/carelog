# SEC-001 Rotation Execution Plan — 2026-05-17

Operational plan for stepping through `docs/runbooks/deploy-fix-and-live-test.md` to rotate the 6 production secrets called out by SEC-001 (Upstash, Resend, Inngest pair, Supabase service role, Stripe webhook).

**Status:** DRAFT, execution deferred. User not ready with 1Password values. Run when ready in a ~45-min window.

## Goal

Complete the long-deferred SEC-001 secrets rotation against production, with per-secret verification, and close the row in §7. Operationalizes `SECRETS_ROTATION.md` against current production with the bisect discipline the runbook enforces.

## Risks surfaced before execution

### R1 — Vercel production deploy ambiguity (HIGH)

Root `vercel.json` `ignoreCommand` exits 1 on `main` ref → automatic production deploys from main pushes are skipped by design (PR #573). Every recent `target: "production"` deploy in the Vercel API shows `state: CANCELED`.

**Unknowns:**
- Whether CLI `vercel --prod` from `apps/web/` actually deploys (CLI deploys bypass `ignoreCommand` *unless* Vercel is also account-level rate-limited). PR #593's preview deploy hit "build-rate-limit — retry in 24 hours" — that may or may not affect CLI prod deploys.
- What commit SHA is currently running in production (no recent READY production deploy in the API; current prod might be days/weeks stale).
- Whether `vercel env` changes propagate to a non-redeploying production runtime (Next.js serverless functions read `process.env` at invocation, but bundled `NEXT_PUBLIC_*` vars require rebuild).

**Required spike before execution:** see Spike 1 below.

### R2 — TD-146 cron-firing unresolved (MEDIUM)

Inngest production showed 0 events in 24h at the 2026-05-15 audit despite ~387 cron firings/day expected. Runbook §3d Inngest step uses this rotation as the natural moment to re-check. Without a pre-rotation baseline, we can't attribute post-rotation cron behavior to the key rotation vs the underlying TD-146 cause.

**Required spike before execution:** see Spike 2 below.

### R3 — Vercel CLI auth state (LOW)

Runbook §1 requires `vercel whoami && vercel project ls` to confirm CLI is authenticated and pointed at the carelog project. If `vercel login` is needed mid-runbook, that's an interactive step that blocks the agent — pre-flight check matters.

## Pre-execution spikes

### Spike 1 — Vercel production deploy reality check (~15 min, blocking)

**Question:** Can we actually deploy to production right now?

**Steps:**
1. From `apps/web/`, run `vercel inspect <prod-domain>` to find the currently-running production deployment's commit SHA + deploy date.
2. Compare to `git rev-parse origin/main` — quantify the staleness.
3. Run a no-op `vercel --prod` (no code change, just trigger). If `apps/web/vercel.json` `ignoreCommand` (which calls `scripts/vercel-ignore-build.sh`) blocks it, force-deploy via `vercel --prod --force` OR temporarily strip the ignore.
4. Watch the deploy state — READY means CLI bypasses the main-ref skip; CANCELED with rate-limit error means we're blocked until the quota window resets.
5. If READY, capture deploy duration so we can budget the rotation window accurately.

**Output:** Single paragraph stating: current prod SHA, gap from main, whether CLI prod deploys work today, expected per-deploy duration.

**Dispatch as:** `/invoke-cowork` brief, OR direct execution in Phase 0 of the runbook (recommended — operator has Vercel CLI auth locally).

### Spike 2 — TD-146 pre-rotation Inngest baseline (~5 min, blocking)

**Question:** Are crons firing in production right now, before we touch Inngest keys?

**Steps:**
1. Open Inngest production dashboard (`https://app.inngest.com/env/production/`) → Runs.
2. Count runs in the last 24h. Capture screenshot or note count.
3. Inspect the most recent scheduled-cron event (if any) — note the schedule + last fire time.
4. Save the baseline in this plan doc before rotation starts.

**Output:** "Inngest baseline 2026-05-17: N runs in last 24h, last cron fire <timestamp> for <function>" — pasted into a §Baseline section below.

**Dispatch as:** direct, in pre-flight Phase 1 of the runbook.

### Spike 3 (OPTIONAL) — Stripe webhook signature pre-check (~5 min, non-blocking)

**Question:** Is the production-bundled Stripe webhook secret the one Stripe believes it should be using? (Catches the case where a prior rotation attempt half-landed.)

**Steps:**
1. Send a test event from Stripe dashboard (`invoice.payment_succeeded`).
2. Check Stripe delivery log — 200 means current state is consistent; 400 means we have a pre-existing mismatch to clean up before rotation, not during.

**Skip if** the most recent prod deploy is older than the most recent Stripe webhook rotation in dashboard history (in which case the mismatch is already known).

## Execution phases

| Phase | Step | Runbook §  | Notes |
|---|---|---|---|
| 0 | Spike 1 (Vercel reality) + Spike 2 (Inngest baseline) | — | Blocks all rotation |
| 1 | Pre-flight | §1 | Clean main, CLI auth, dashboards open, 1Password ready |
| 2 | UPSTASH_REDIS_REST_TOKEN | §2 row 1 + §3 | Lowest blast; failures degrade permissive |
| 3 | RESEND_API_KEY | §2 row 2 + §3 | Verify via magic-link to `brady.grapentine@gmail.com` |
| 4 | INNGEST_SIGNING_KEY + INNGEST_EVENT_KEY (paired) | §2 row 3 + §3 | Rotate together; compare against Spike 2 baseline for TD-146 |
| 5 | SUPABASE_SERVICE_ROLE_KEY | §2 row 4 + §3 | Verify via incognito signup → `/api/onboarding/create` 200 |
| 6 | STRIPE_WEBHOOK_SECRET | §2 row 5 + §3 | LAST; narrow signature-failure window |
| 7 | Post-rotation local dev hygiene | §4 | `vercel env pull --environment=development apps/web/.env.local` |
| 8 | Close-out | §5 | Update SECRETS_ROTATION.md, `/backlog-sync` SEC-001 → ✅ Shipped, git history scrub |

## Acceptance criteria (Plan complete when)

- [ ] Spike 1 answered: prod CLI deploy works OR is blocked (with reason).
- [ ] Spike 2 baseline captured below.
- [ ] Each of 5 rotation phases passes its §3d verification.
- [ ] Post-rotation `.env.local` has `eyJ`-prefixed Supabase service role key.
- [ ] `/backlog-sync` lands a chore PR promoting SEC-001 to §7 Shipped.
- [ ] Git history scrub commands (§5) return empty.
- [ ] TD-146 cron-firing observation noted in TD-146 row (whether rotation fixed it or didn't).

## Out-of-scope (do NOT add to this execution)

- DMARC / sender hardening (TD-151) — separate runbook `td-151-dmarc-sender-hardening.md`.
- Stripe price catalog or subscription changes — only the webhook signing secret is in scope.
- Database migrations or RLS work — secrets only.
- Backlog reconciliation beyond the SEC-001 row.

## Baseline section (fill during Spike 2)

```
Inngest baseline 2026-05-17 <HH:MM>:
- Runs in last 24h: <N>
- Last cron fire: <timestamp> for <function name>
- Notes: <any anomalies>
```

## Rollback contract

Per runbook §6: Vercel env-var history allows restore-prior-value. But for Supabase/Resend/Upstash, source-side revocation is immediate → no rollback possible. Roll forward only. Stripe/Inngest signing keys can sometimes coexist briefly — confirm in dashboard before assuming rollback safety.

## References

- `docs/runbooks/deploy-fix-and-live-test.md` — the runbook this plan operationalizes
- `docs/project-info/runbooks/SECRETS_ROTATION.md` — source rotation procedure
- `docs/project-info/runbooks/SECRETS_ROTATION-audit-2026-05-14.md` — pre-rotation audit findings
- `BACKLOG.md` — SEC-001 row + TD-146 row
- `docs/research/2026-05-15-inngest-vs-queues.md` §6.6 — TD-146 cron-firing context
