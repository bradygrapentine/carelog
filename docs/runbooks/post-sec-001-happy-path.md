# Post-SEC-001 happy-path live test (Cowork-driven)

> **Update 2026-05-17:** DMARC mitigation shipped via TD-151 ([runbook](./td-151-dmarc-sender-hardening.md)). Re-runs of this live test should now pass Phase 1 against Gmail (no more silent drops).

Delegate the full user-flow live test against https://care-log.org to a remote Cowork agent so the operator doesn't have to click through. Cowork drives a real browser, exercises signup → onboarding → dashboard → settings, and reports per-integration pass/fail. ~5 min of operator time, ~10 min Cowork wall-clock.

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

> **Out-of-scope (TD-153 Path B).** The following screens existed in earlier versions of CareSync and are NOT present in current production. Cowork must SKIP — not FAIL — any step that reaches these surfaces. Rebuilding them is tracked under TD-153 Path B (see [BACKLOG.md](../../BACKLOG.md)):
> - Stripe Checkout "Choose a plan" onboarding step
> - `/journal` route (returns 404)
> - `/medications` route (returns 404)
> - Team-invite tab in Settings

> Cowork: "Live-test CareSync production at https://care-log.org end-to-end. Open a fresh incognito-mode browser session via your chrome-devtools-mcp tools and walk this exact flow. Report after each phase with PASS/FAIL/SKIP + a one-line note. Stop the run on any FAIL and report the failing step's HTTP status, console error, and a screenshot.
>
> PHASE 1 — SIGNUP (passwordless OTP)
> 1. Navigate to https://care-log.org. Click 'Sign up'.
> 2. Generate a throwaway email `brady.grapentine+livetest-<unix-ts>@gmail.com`. Enter it. Submit (no password field — this is passwordless).
> 3. Read the most recent OTP email via the Gmail MCP for brady.grapentine@gmail.com (filter: from:noreply@care-log.org OR from:auth@care-log.org received in last 2 min). Extract the 6-digit code.
> 4. Enter the 6-digit code in the OTP input field on the sign-in page. Submit.
> 5. Confirm a session is established (redirect away from the sign-in page).
> EXPECTED: Supabase Auth issues a 6-digit OTP, code validates, session active. PASS criteria = redirected to app. No magic-link click — the flow is OTP only.
>
> PHASE 2 — ONBOARDING
> 6. Enter org name 'Live Test <HHMM>'.
> 7. Add recipient: 'Test Recipient', DOB 1944-01-01, relationship 'Parent'. Save.
> EXPECTED: Lands on the dashboard (primary care surface). No Stripe Checkout step.
>
> PHASE 3 — DASHBOARD
> 8. Confirm the dashboard loads without errors (no blank screen, no 500/404 in console).
> 9. Verify the recipient's name ('Test Recipient') is visible on the dashboard.
> EXPECTED: Supabase RLS read succeeds. PASS = recipient visible on dashboard.
>
> PHASE 4 — SETTINGS CHECK
> 10. Navigate to Settings.
> 11. Confirm these tabs are present: Profile, Notifications, Language, Refer, Danger zone.
> 12. Confirm there is NO 'Team' or 'Invite' tab in Settings (team-invite UI not in current prod — see Out-of-scope above).
> EXPECTED: Exactly the five tabs above visible; no team-invite tab.
>
> PHASE 5 — RATE LIMIT (Upstash)
> 13. Log out. Back at the sign-in page, submit the OTP request form 6 times within 10 seconds against the throwaway email.
> 14. Confirm a 'Too many requests' / 429-style error appears by attempt 5 or 6, NOT a 500.
> EXPECTED: Upstash rate limiter intercepts.
>
> PHASE 6 — INTEGRATION VERIFICATION (no browser)
> 15. Via Inngest MCP / dashboard scrape, confirm: app 'carelog' Last seen < 5 min ago, no Failed runs in last 1h with 'Invalid API key' or 'Legacy API keys are disabled' errors.
>
> FINAL REPORT
> Emit a markdown table:
>   | Phase | Integration | Result | Note |
>   |---|---|---|---|
>   | 1 | Supabase Auth + Resend (OTP) | PASS/FAIL | … |
>   | 2 | Supabase RLS (org+recipient writes) | PASS/FAIL | … |
>   | 3 | Supabase RLS (dashboard read) | PASS/FAIL | … |
>   | 4 | Settings tabs (current prod shape) | PASS/FAIL | … |
>   | 5 | Upstash rate limit | PASS/FAIL | … |
>   | 6 | Inngest reachability | PASS/FAIL | … |
>
> Save the final report + screenshots to /tmp/caresync-live-test-<unix-ts>/. Cleanup at end: delete the test org via the app's Danger Zone, log out."

- [ ] Paste the brief above into Cowork. Wait for completion.

## 3. Operator review

- [ ] Read the final PASS/FAIL table from Cowork
- [ ] For each FAIL: open the linked screenshot + console log, confirm whether it's a rotation issue or unrelated bug

> Watch: any FAIL with `Legacy API keys are disabled` or `Invalid API key` → Vercel still has a stale Supabase env var. Re-check `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` Production tier values.

> Watch: Phase 1 FAIL on OTP delivery → check Resend delivery logs for the throwaway email; confirm `RESEND_API_KEY` is current (post-SEC-001 rotation).

## 4. Cleanup confirmation

Cowork is instructed to clean up, but verify it actually did:

- [ ] App: no leftover Live Test org visible to the brady.grapentine account
- [ ] Inboxes: archive the throwaway test emails

> Ask: "from /Users/bradygrapentine/projects/carelog, append today's live-test result table to docs/runbooks/post-sec-001-happy-path.md as a new §5 'Run log' section with date prefix. Format as the same markdown table Cowork produced."

## 5. Run log

(Cowork results land here on each run. Newest at the top.)

## Related

- [SEC-001 rotation runbook](./deploy-fix-and-live-test.md)
- [Master secrets-rotation runbook](../project-info/runbooks/SECRETS_ROTATION-runbook.md)
- [BACKLOG: TD-146 cron-firing audit](../../BACKLOG.md)
