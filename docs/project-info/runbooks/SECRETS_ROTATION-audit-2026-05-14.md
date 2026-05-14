# SECRETS_ROTATION.md — Audit Memo (2026-05-14)

**Audit scope:** Read-only freshness check of `docs/project-info/runbooks/SECRETS_ROTATION.md` (164 lines, authored 2026-05-10 for SEC-001) against the codebase at `f11bca1` (origin/main, 2026-05-14 PM).
**Audit type:** READ-ONLY — no edits applied. Findings are recommendations for the rotation operator (the human running the rotation) and for a future maintenance pass.

---

## Verdict

**Runbook is largely accurate and operationally usable.** All 6 listed secrets are still relied on, all cross-referenced docs exist, the verification commands resolve to real routes. Two staleness items and one substantive gap below — none block executing the rotation today, but worth folding into the next edit.

---

## Detailed findings

### F1 — Env var grep coverage (informational, not a defect)

Of the 6 secrets in §1's table, grep against `apps/web` finds explicit `process.env.NAME` reads for:

| Var | Refs in `apps/web/**/*.ts{,x}` |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | 5 |
| `STRIPE_WEBHOOK_SECRET` | 3 |
| `RESEND_API_KEY` | 2 |
| `UPSTASH_REDIS_REST_TOKEN` | 3 |
| `INNGEST_SIGNING_KEY` | **0** |
| `INNGEST_EVENT_KEY` | **0** |

The Inngest signing/event keys are consumed by the `inngest` SDK internally (via `Inngest({ id: '...' })` in `apps/web/inngest/client.ts`); the SDK reads them from `process.env` at construction time. They are NOT obsolete — the runbook is correct to list them. **Recommendation:** add a one-line note in the runbook's §1 table that the two Inngest values aren't grep-findable by name; consumers who don't know the SDK might assume they're stale.

### F2 — Vercel CLI version is now further outdated

Runbook L155 says *"The Vercel CLI is currently on a stale version (53.2.0). Recommend `npm i -g vercel@latest` for latest agentic features and bug fixes."*

As of this session, the CLI is now at **54.0.0** per the harness's session-start advisory. The runbook line is functionally correct (still recommends `npm i -g vercel@latest`) but the specific old-version anchor (`53.2.0`) is dated. **Recommendation:** drop the specific version number and keep the install command — version-drift footnotes age badly.

### F3 — Verification routes resolve to real files

Spot-checked: `apps/web/app/api/onboarding/create/route.ts` exists (runbook L45 verification step). The Stripe webhook handler `apps/web/app/api/stripe/webhook/route.ts` is the route the Stripe test-event step (L46) targets — present, signature-verified, and since this morning's SEC-002 wave, event-ID dedup'd via `stripe_events` upsert.

### F4 — Cross-references resolve

- `docs/adr/0001-phi-anonymous-uuid-only.md` exists (L164).
- `docs/project-info/technology/SECURITY_MODEL.md` exists (L163).
- `BACKLOG.md` SEC-001 row still present at §1 line 150 (status `🔴 In progress · P0`), as the runbook expects (L161).

### F5 — `supabase status -o env` is the correct invocation

Runbook L100 prescribes `supabase status -o env`. Confirmed: `supabase status --help` documents the `-o env | pretty | json | toml | yaml` flag. The local-CLI is on 2.84.2 (current is 2.98.2 per CLI advisory); the flag has been stable across this minor-version range so the runbook is safe.

### F6 — Sub-step gap: the "old secret is dead" verification (L50)

Runbook §1.5 says *"Confirm the OLD secret is dead. For Stripe webhook secret specifically, requests signed with the old secret should now fail signature verification."* This is good guidance but only spelled out for Stripe. For the other secrets the runbook implicitly relies on dashboard-side revocation being immediate. In practice:

- **Resend, Inngest, Upstash, Supabase service role** — all support immediate revocation at the dashboard; old key is rejected on next use. The runbook's verification chain (test the relying endpoint with the new key) implicitly confirms the new key works, but does NOT confirm the old key fails closed. A separate "test with the OLD key, expect 401" pass would be defense-in-depth.

**Recommendation:** add a sentence in §1.4 acknowledging that the verification step confirms the NEW key works; explicit OLD-key-rejection testing is encouraged but optional given dashboard-side revocation immediacy.

### F7 — Stripe rotation ordering caveat (L52) is still load-bearing

Runbook L52 — *"Order matters for Stripe: roll the webhook secret last and verify the redeployed function picks up the new secret BEFORE the next real webhook fires"* — remains correct guidance. Today's SEC-002 PR #488 added event-ID dedup, which means a duplicate replay from a Stripe retry no longer double-processes, but does NOT change the rotation ordering concern (a webhook with the old signature still hits the signature-verification 400 path). Order-matters guidance stands.

---

## Items that would belong in a future runbook revision (not blocking)

1. Add the F1 Inngest grep-invisibility note.
2. Drop the F2 specific Vercel CLI version number.
3. Add the F6 old-key-rejection encouragement.
4. Consider linking the SEC-002 dedup table from §1 background — Stripe webhook rotation is now slightly less risky (replays are dedup'd) but not zero-risk.

These are quality-of-life polish; the runbook is operationally correct as-is.

---

## Recommendation to the rotation operator

The runbook is **safe to execute as written**. Walk the §1.4 Procedure step-by-step, use the §1.4 checklist verbatim, defer the §3 "go forward" alias setup until after the rotation completes. Once §1 is done end-to-end, ping `/backlog-sync` to flip SEC-001 to ✅ Shipped.

**Audit complete.** No edits to `SECRETS_ROTATION.md` proposed in this PR — items above are future-revision candidates, not blockers.
