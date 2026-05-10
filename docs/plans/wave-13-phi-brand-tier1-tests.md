# Wave 13 — PHI gate · brand cleanup · Tier-1 test coverage

**Stories:** UX-045, UX-051, TD-78, TD-79, TD-80, TD-81, TD-82
**Estimated effort:** ~7.5 hr total across 7 PRs
**Base:** `origin/main` (post-PR #395)

---

## Strategy

Split into **two parts**:

- **Part A — direct, serial (2 PRs):** UX-045 + UX-051. Small, judgment-heavy, both touch mostly distinct files but warrant a careful eye (PHI gate + brand grep). Direct implementation; no dispatch overhead.
- **Part B — parallel dispatch (5 PRs):** TD-78..82. File-disjoint test additions, mechanical TDD-style. Perfect dispatch fan-out.

Why split: Part A is high-stakes (active PHI exposure + paying-customer-visible brand bug) and should ship first. Part B can run in parallel after A merges so the test PRs branch off a clean main.

---

## Part A — direct (sequential, ~1.5 hr)

### A.1 UX-045 — gate `dob` in brief share

**Files:**
- `apps/web/app/brief/[shareToken]/BriefEditorial.tsx` — wrap `content.dob` render behind `brief.includes.includes("dob")`
- `apps/web/server/routers/briefs.ts` (or wherever `includes` enum lives) — add `"dob"` to the enum
- `apps/web/app/brief/[shareToken]/__tests__/BriefEditorial.test.tsx` — add 2 tests: `includes` without `"dob"` → DOB hidden; `includes` with `"dob"` → DOB visible
- Default new family-share briefs (briefs UI) to `includes` without `"dob"`; if there's a UI that builds the includes array, gate the default there too. Confirm scope before touching UI.

**Rules:**
- PHI-relevant — must invoke `rls-reviewer` agent on the diff before opening PR.
- Existing briefs in DB may have `dob` in content but not in `includes`; verify default render is now hidden (i.e. fail-closed).

**Branch:** `feat/ux-045-brief-dob-gate`
**Verify:** `cd apps/web && npx vitest run app/brief && npx tsc --noEmit && npx eslint --quiet app/brief`
**Merge:** queue label.

---

### A.2 UX-051 — `care-log.org` → `caresync.app` in user-facing strings

**Triage rule:** swap user-facing strings (email addresses in copy, marketing surfaces). **Do NOT touch** `robots.ts` / `sitemap.ts` / API base URLs / domain references that legitimately encode the production hostname — those are infrastructure, not branding. Confirm each grep hit individually.

**Likely files (verify each before edit):**
- `apps/web/app/(app)/subscriptions/page.tsx:188` (confirmed in backlog)
- `apps/web/app/(app)/team/admin/TeamAdminClient.tsx:159` (confirmed in backlog)
- Marketing surfaces with literal `hello@care-log.org` strings: `(marketing)/contact/page.tsx`, `(marketing)/privacy/page.tsx`, `(marketing)/terms/page.tsx`, `(marketing)/trust/page.tsx`, `(marketing)/about/page.tsx`, `(marketing)/pricing/page.tsx`, `(marketing)/for-referrers/page.tsx`, `(marketing)/page.tsx`
- `apps/web/components/marketing/ForReferrersPage.tsx`
- `apps/web/app/onboarding/OnboardingForm.tsx`
- `apps/web/app/(app)/billing/success/page.tsx`
- `apps/web/app/api/contact/route.ts` + `route.test.ts` (if "from" address is user-facing)

**Skip / verify-then-skip:**
- `apps/web/app/robots.ts`, `apps/web/app/sitemap.ts` — domain config, not branding.
- `apps/web/app/api/stripe/__tests__/portal.test.ts` — test fixture; only touch if it asserts on user-visible string.

**Branch:** `chore/ux-051-brand-email-cleanup`
**Verify:** `rg "care-log\.org" apps/web` after edits; remaining hits should be only infra (or none).
**Tests:** `cd apps/web && npx vitest run`
**Merge:** queue label.

---

## Part B — parallel dispatch (~5.5 hr wall; ~1.5 hr after fan-out)

Wait for Part A to merge so each test PR branches off a clean main. Then dispatch 5 subagents in **one message** with disjoint file ownership.

### Pre-dispatch (required)

1. `git checkout main && git pull --ff-only` — confirm both Part A PRs landed.
2. `git fetch origin && git rev-parse origin/main` — print this SHA; every subagent branches from it.
3. Confirm `pnpm test` + `cd apps/web && npx vitest run` green on HEAD before dispatch.
4. Verify each `FILES ALLOWED` path with `ls` before sending the prompts.

### Dispatch table

| Story | Branch | Files (write) | Model | Notes |
|---|---|---|---|---|
| TD-78 | `test/td-78-user-router` | `apps/web/server/routers/__tests__/user.test.ts` (new) | sonnet | Auth-boundary; `IANA_TIMEZONE_PATTERN` bypass cases (`"../../../"`, empty); `dismissEducationTip` date math; `updateNotifications` upsert idempotency; `ctx.user = null → 401`. ~1.5 hr |
| TD-79 | `test/td-79-care-events-repo` | `apps/web/server/repositories/__tests__/careEventsRepository.test.ts` (new) | sonnet | `validatePayload()` regression net; cross-recipient `getTimeline` returns empty; `insertEvent()` org_id boundary. PHI-adjacent — UUID-only assertions. ~1.5 hr |
| TD-80 | `test/td-80-stripe-init` | `apps/web/lib/__tests__/stripe.test.ts` (new) | sonnet | Missing `STRIPE_SECRET_KEY` → clear error; singleton identity; API version `"2026-03-25.dahlia"` current. ~0.5 hr |
| TD-81 | `test/td-81-orgs-repo` | `apps/web/server/repositories/__tests__/organizationsRepository.test.ts` (new) | sonnet | Cross-org fixtures + org UUID assignment. ~1.5 hr |
| TD-82 | `test/td-82-care-events-client-id` | `supabase/tests/care_events_client_id.test.sql` (new) **OR** add a comment to existing `supabase/tests/care_events_rls.test.sql` documenting coverage | sonnet | RLS pgTAP. Run `supabase test db` to verify. ~0.5 hr |

### Subagent scope contract template

```
FILES ALLOWED: <single file path>
BRANCH: <branch from table>
DO NOT: add features, touch BACKLOG.md, modify production source files, pass email/PHI to analytics
PHI RULE: posthog.identify() and posthog.capture() must use UUID only — never email, name, or any PII
TDD: write failing tests first, run vitest (or `supabase test db` for TD-82), iterate to green. Max 5 iterations — if stuck, stop and report.
PUSH-EARLY: this is a single-file dispatch so context exhaustion is unlikely, but commit the red-phase first then the green-phase to leave a recoverable trail.
VERIFY: `cd apps/web && npx vitest run <test-file>` (TD-78..81) or `supabase test db` (TD-82) — must be green before opening PR.
PR: open with conventional title `test(td-NN): …`, body links the story row in BACKLOG.md.
MERGE: apply `queue` label after open. Do NOT use `gh pr merge --auto`.
```

### Post-dispatch verification (required, per dispatch §5a)

For each branch from the table:

```sh
gh pr list --author @me --json number,headRefName \
  | jq -r --arg b "<branch>" '.[] | select(.headRefName == $b) | .number' \
  | grep -q . \
  || echo "[ALERT] subagent reported DONE but no PR exists for <branch>"
```

If any alert fires, `cd .worktrees/<name> && git status` and finish the commit + PR yourself — do **not** redispatch.

---

## Merge order

1. UX-045 (PHI fix — highest priority, ship first)
2. UX-051 (brand cleanup)
3. TD-78..82 — any order; queue all 5 once Part A is in main and CI green.

After all 7 merge: `/backlog-sync` to flip rows to §7.

---

## Out of scope

- UX-066 (RecipientProfile enrichment) — separate Wave.
- TD-87 Lighthouse a11y path — spike, not implementation.
- Updating the brand-name rule in `MEMORY.md` — already documented; no change needed unless a new ambiguity surfaces during UX-051.

## Risks

- **UX-045 schema:** if `includes` is a Zod enum at the DB-write boundary, adding `"dob"` may need a migration to widen a check constraint. Spike before editing the enum if DB-side validation exists.
- **UX-051 over-reach:** the grep returns 18 hits across infra + branding. Touching `robots.ts`/`sitemap.ts` would change the production hostname — explicitly out of scope. Verify each hit individually.
- **TD-82 ambiguity:** the row offers two paths (new test file OR document existing coverage). Subagent should default to a thin new test file (3-5 lines) referencing the existing rls test, not a full duplicate.
