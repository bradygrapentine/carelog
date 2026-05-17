# Post-SEC-001 happy-path live test (Cowork-driven)

> **Update 2026-05-17:** DMARC mitigation shipped via TD-151 ([runbook](./td-151-dmarc-sender-hardening.md)). Re-runs of this live test should now pass Phase 1 against Gmail (no more silent drops).

Delegate the full user-flow live test against https://care-log.org to a remote Cowork agent so the operator doesn't have to click through. Cowork drives a real browser, exercises signup → Stripe → onboarding → journal → invite, and reports per-integration pass/fail. ~5 min of operator time, ~15 min Cowork wall-clock.

## 1. Prerequisites

- [ ] Confirm production is deployed and reachable

```bash
curl -sI https://care-log.org | head -1
```

- [ ] Have a Cowork agent session ready (browser tab open)
- [ ] Throwaway email + Gmail+tag pattern is fine — Cowork agent reads the inbox via Gmail MCP

> Watch: SEC-001 rotated keys mid-day 2026-05-16. Any pre-rotation Cowork session may have stale credential state — start a fresh Cowork agent for this run.

## 2. Single-dispatch Cowork brief

Paste this entire prompt into your Cowork agent. Cowork executes the full happy path and reports back structured results.

> Cowork: "Live-test CareSync production at https://care-log.org end-to-end. Open a fresh incognito-mode browser session via your chrome-devtools-mcp tools and walk this exact flow. Report after each phase with PASS/FAIL/SKIP + a one-line note. Stop the run on any FAIL and report the failing step's HTTP status, console error, and a screenshot.
>
> PHASE 1 — SIGNUP
> 1. Navigate to https://care-log.org. Click 'Sign up'.
> 2. Generate a throwaway email `brady.grapentine+livetest-<unix-ts>@gmail.com`. Enter it + a 16-char random password. Submit.
> 3. Read the most recent magic-link / confirmation email via the Gmail MCP for brady.grapentine@gmail.com (filter: from:noreply@care-log.org OR from:auth@care-log.org received in last 2 min). Click the link.
> 4. Confirm landing on the onboarding 'Choose a plan' step.
> EXPECTED: Supabase Auth issues magic link, link redeems, session active. PASS criteria = onboarding step visible.
>
> PHASE 2 — STRIPE CHECKOUT
> 5. Click the $14/month family plan → Stripe Checkout loads.
> 6. Enter test card 4242 4242 4242 4242, any future expiry (e.g. 12/30), any 3-digit CVC, any ZIP. Submit.
> 7. Wait for redirect back to the app (≤10s). Confirm post-checkout success screen.
> EXPECTED: Stripe webhook fires, subscription activates. PASS = success screen, no 'Activating…' hang.
>
> PHASE 3 — ONBOARDING
> 8. Enter org name 'Live Test <HHMM>'.
> 9. Add recipient: 'Test Recipient', DOB 1944-01-01, relationship 'Parent'. Save.
> EXPECTED: Lands on recipient profile.
>
> PHASE 4 — FIRST JOURNAL ENTRY
> 10. Navigate to Journal tab from the recipient profile.
> 11. Click '+ New entry'. Body: 'live test entry post-rotation'. Mood: Okay. Save.
> 12. Refresh the page. Confirm entry persists in timeline.
> EXPECTED: Supabase RLS write succeeds, entry visible after refresh.
>
> PHASE 5 — INVITE TEAM MEMBER
> 13. Navigate to Team panel. Click 'Invite a member'.
> 14. Invite email: `brady.grapentine+livetest-member-<unix-ts>@gmail.com`, role Team Member. Send.
> 15. Wait up to 60s, then read that inbox via Gmail MCP. Confirm Resend-delivered invite arrives.
> EXPECTED: Email delivered via Resend.
>
> PHASE 6 — RATE LIMIT (Upstash)
> 16. Back at the login page, click 'Send Magic Link' 6 times within 10 seconds against the invite email.
> 17. Confirm a 'Too many requests' / 429-style error appears by attempt 5 or 6, NOT a 500.
> EXPECTED: Upstash rate limiter intercepts.
>
> PHASE 7 — INTEGRATION VERIFICATION (no browser)
> 18. Via Stripe MCP or dashboard scrape, confirm: customer exists for the throwaway email, subscription = Active, latest invoice = paid, latest webhook delivery to care-log.org = 200.
> 19. Via Inngest MCP / dashboard scrape, confirm: app 'carelog' Last seen < 5 min ago, no Failed runs in last 1h with 'Invalid API key' or 'Legacy API keys are disabled' errors.
>
> FINAL REPORT
> Emit a markdown table:
>   | Phase | Integration | Result | Note |
>   |---|---|---|---|
>   | 1 | Supabase Auth + Resend (magic link) | PASS/FAIL | … |
>   | 2 | Stripe webhook + checkout | PASS/FAIL | … |
>   | 3 | Supabase RLS (org+recipient writes) | PASS/FAIL | … |
>   | 4 | Supabase RLS (journal write) | PASS/FAIL | … |
>   | 5 | Resend (invite email) | PASS/FAIL | … |
>   | 6 | Upstash rate limit | PASS/FAIL | … |
>   | 7 | Stripe + Inngest reachability | PASS/FAIL | … |
>
> Save the final report + screenshots to /tmp/caresync-live-test-<unix-ts>/. Cleanup at end: cancel the Stripe subscription (test mode), delete the test org via the app's Danger Zone, log out."

- [ ] Paste the brief above into Cowork. Wait for completion.

## 3. Operator review

- [ ] Read the final PASS/FAIL table from Cowork
- [ ] For each FAIL: open the linked screenshot + console log, confirm whether it's a rotation issue or unrelated bug

> Watch: any FAIL with `Legacy API keys are disabled` or `Invalid API key` → Vercel still has a stale Supabase env var. Re-check `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` Production tier values.

> Watch: any FAIL on Phase 2 with a stuck "Activating…" screen → `STRIPE_WEBHOOK_SECRET` rotation didn't take; check the Stripe webhook attempts page for non-200s.

## 4. Cleanup confirmation

Cowork is instructed to clean up, but verify it actually did:

- [ ] Stripe dashboard: no leftover Active subscription on the throwaway email
- [ ] App: no leftover Live Test org visible to the brady.grapentine account
- [ ] Inboxes: archive the throwaway test emails

> Ask: "from /Users/bradygrapentine/projects/carelog, append today's live-test result table to docs/runbooks/post-sec-001-happy-path.md as a new §5 'Run log' section with date prefix. Format as the same markdown table Cowork produced."

## 5. Run log

(Cowork results land here on each run. Newest at the top.)

## Related

- [SEC-001 rotation runbook](./deploy-fix-and-live-test.md)
- [Master secrets-rotation runbook](../project-info/runbooks/SECRETS_ROTATION-runbook.md)
- [BACKLOG: TD-146 cron-firing audit](../../BACKLOG.md)
