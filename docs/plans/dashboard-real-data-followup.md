# Dashboard real-data follow-up — Wave A + Wave B

Two parallelizable waves. Run in independent sessions; zero file overlap.
Base SHA at planning time: `845750d0` (post #243 master/detail layout).

In-flight PRs that gate Wave A only:
- #244 — feat(dashboard): wire BriefHero to real `briefs.latestForRecipient`
- #245 — feat(dashboard): wire MedCard to real `medications.*`
- #246 — feat(dashboard): wire MoodCard to real `moodEntries.sparkline`

---

## Wave A — Dashboard integration + E2E unblock

**Goal:** Finish the data-wiring round (#244/245/246) by threading recipient/org
context into the three dashboard cards, and unblock the merge queue by repairing
the E2E selector regressed by #243's master/detail layout.

**Pre-flight (run in session before any code):**
1. `git fetch origin && git log origin/main --oneline -10` — confirm latest main.
2. Verify #244, #245, #246 all show `mergedAt != null` via
   `gh pr view <num> --json mergedAt,state`. If any are still open, STOP — Wave A
   depends on them.
3. Print the base SHA Wave A will branch from. Branch name: `feat/dashboard-realdata-integration`.

### A1 — Thread `recipientId/orgId` into the three cards

**File:** `apps/web/app/(app)/dashboard/DashboardClient.tsx`

Both call sites (`~430` multi-team layout, `~496` single-team layout) currently
render `<BriefHero />`, `<MedCard />`, `<MoodCard />` with no props. Pass the
primary team's identifiers — the existing pattern is `teams[0]!.recipientId` and
`teams[0]!.org.id` (see `DashboardClient.tsx:126,375` for prior usage).

Pseudocode:
```tsx
const primary = teams[0];
// ...
<BriefHero recipientId={primary?.recipientId} orgId={primary?.org.id} />
<MedCard   recipientId={primary?.recipientId} orgId={primary?.org.id} />
<MoodCard  recipientId={primary?.recipientId} orgId={primary?.org.id} />
```

All three components already accept optional props (post-#244/245/246) and render
empty/skeleton state when missing — do not re-add required props.

### A2 — DashboardClient real-data integration test

**New file:** `apps/web/app/(app)/dashboard/__tests__/DashboardClient.realData.test.tsx`

One test asserting that, given a single team and mocked tRPC responses for the
three queries (`briefs.latestForRecipient`, `medications.listScheduled`,
`moodEntries.sparkline`), DashboardClient renders the three cards with their
real-data content. Mock pattern: same as the existing `BriefHero.test.tsx`
tRPC mock (look there for the canonical setup).

Do NOT mock the cards themselves in this test — the whole point is to exercise
the integration. The existing `DashboardClient.test.tsx` and
`DashboardClient.flow.test.tsx` keep their card-mocks (those test other concerns).

### A3 — Repair E2E selector broken by #243

**Symptom (from CI runs 25071734727 / 25071737082 / 25071739276):**
```
TimeoutError: page.waitForSelector: Timeout 30000ms exceeded.
- waiting for locator('text="View care journal"') to be visible
```

The string "View care journal" no longer appears post-#243 — the master/detail
layout uses `<Link aria-label={`Open care journal for ${team.org.name}`}>`
(see `DashboardClient.tsx:453`).

**Steps:**
1. `grep -rn "View care journal" e2e/` to find the failing spec.
2. Replace the locator with one that matches current DOM. Preferred:
   `page.getByRole("link", { name: /Open care journal for/i })`. Avoid raw text
   selectors.
3. Run `pnpm exec playwright test <spec>` locally (Supabase must be up) to verify
   the spec is actually green, not just compiling. Document any second-order
   failure in the PR description rather than papering over.

### A4 — Mark UX-035 shipped (separate `chore(backlog)` PR)

UX-035 was "gate BriefHero mock content behind feature flag or skeleton" — PR #244
removed the mock entirely. Per CLAUDE.md, BACKLOG.md edits never ride feature PRs.

Open a dedicated `chore(backlog): mark UX-035 shipped (#244)` PR after Wave A's
feature PR merges, OR let `/backlog-sync` pick it up on its next run. Do NOT
include this in the Wave A feature PR.

### Wave A — execution mode

- **Single PR** for A1+A2+A3 (small surface, tightly coupled — splitting would
  create rebase pain on `DashboardClient.tsx`).
- **Direct Opus**, not dispatched. Three tasks, one file mostly, judgment-heavy
  on the E2E selector.
- Local green gates `gh pr ready`: `cd apps/web && npx vitest run` +
  `cd apps/web && npx tsc --noEmit` + `pnpm exec playwright test e2e/<the-spec>`.
- Apply Mergify `queue` label after green; schedule a 15-minute wakeup.

### Wave A — risks

- **2nd-order E2E failure.** A3's selector fix may surface a downstream
  assertion (the spec was probably testing post-click navigation). Budget: one
  rebase + selector update. If a 3rd selector breaks, escalate rather than
  pile on guesses.
- **Mergify policy on UNSTABLE PRs.** #244/245 are currently UNSTABLE because of
  the same E2E. If Wave A's A3 fixes E2E for the branch, sibling PRs still need
  rebase to inherit the fix. Plan to rebase #244 → #245 → #246 (or queue them
  serially) once A3's fix is on main.

---

## Wave B — Tier-1 server test coverage (TD-77..80)

**Goal:** Close the four highest-risk test gaps surfaced by the Codex audit
(see BACKLOG.md §1 rows TD-77, TD-78, TD-79, TD-80). Four disjoint new test
files; zero source-file edits; zero overlap with Wave A.

### Pre-flight (run in session before any dispatch)

1. `git fetch origin && git rev-parse origin/main` — print base SHA.
2. Confirm Wave B has not already been picked up: `gh pr list --search "TD-77 OR TD-78 OR TD-79 OR TD-80" --state all`.
3. Confirm Docker is up if any test will spin Supabase (TD-77/79 likely will).
4. Worktree layout (under `.worktrees/`, never sibling), one per task:
   - `.worktrees/td-77-identity-tests` → branch `feat/td-77-identity-tests`
   - `.worktrees/td-78-user-router-tests` → branch `feat/td-78-user-router-tests`
   - `.worktrees/td-79-care-events-repo-tests` → branch `feat/td-79-care-events-repo-tests`
   - `.worktrees/td-80-stripe-tests` → branch `feat/td-80-stripe-tests`
5. Symlink `node_modules` per CLAUDE.md (root + apps/web) into each worktree.

### B1 — TD-77 · `identityRepository.test.ts`

**Backlog row:** "Tier 1 — PHI vault. Uses `supabaseAdmin` (no RLS). Untested
cross-org `resolveIdentity(token, org_id)` could leak names/DOB/contact between
orgs in a silent regression."

- **New file (only):** `apps/web/server/repositories/__tests__/identityRepository.test.ts`
- Tests: (a) cross-org token rejection, (b) malformed token, (c) expired token.
- **Owner:** Sonnet via Task tool (judgment-heavy — PHI boundary, real Supabase
  call patterns).
- **Estimate:** ~2 hr.

### B2 — TD-78 · `user.ts` tRPC router tests

**Backlog row:** "Zero auth-boundary tests. `IANA_TIMEZONE_PATTERN` regex
untested for bypass; `dismissEducationTip` date math untested for off-by-one."

- **New file (only):** `apps/web/server/routers/__tests__/user.test.ts`
- Tests: (a) `ctx.user = null` → 401, (b) timezone regex valid/invalid/empty,
  (c) `dismissEducationTip` date math, (d) `updateNotifications` upsert
  idempotency.
- **Owner:** Sonnet via Task tool.
- **Estimate:** ~1.5 hr.

### B3 — TD-79 · `careEventsRepository.test.ts`

**Backlog row:** "Tier 1 — core PHI write. No `validatePayload()` regression
net + no org_id/recipient_id isolation test for `getTimeline`."

- **New file (only):** `apps/web/server/repositories/__tests__/careEventsRepository.test.ts`
- Tests: (a) invalid payload throws before DB write, (b) cross-recipient
  timeline returns empty, (c) `insertEvent()` respects org_id boundary.
- **Owner:** Sonnet via Task tool.
- **Estimate:** ~1.5 hr.

### B4 — TD-80 · `lib/stripe.ts` tests

**Backlog row:** "Singleton init throws if `STRIPE_SECRET_KEY` missing. Zero
test asserting the error path; affects every checkout/upgrade."

- **New file (only):** `apps/web/lib/__tests__/stripe.test.ts`
- Tests: (a) missing env → clear error message, (b) singleton returns same
  instance, (c) API version `"2026-03-25.dahlia"` is current.
- **Owner:** Haiku via Task tool (single file, narrow env-mock pattern, fits
  Haiku's wheelhouse).
- **Estimate:** ~0.5 hr.

### Wave B — Subagent scope contract template

Apply to each B1–B4 dispatch verbatim (per CLAUDE.md):

```
FILES ALLOWED: <single new test file path from above>
BRANCH: <feat/td-XX-...>
DO NOT: edit production code (test-only PR), modify BACKLOG.md, touch any
        sibling test file, pass email/PHI to analytics
PHI RULE: posthog.identify() / posthog.capture() must use UUID only — never
          email, name, or any PII (does not apply here — test-only — but kept
          in the contract per project policy)
VERIFY:
  - cd apps/web && npx vitest run <new test file> --reporter=dot
  - cd apps/web && npx tsc --noEmit
  - Print "Files changed:" with the single test file path; PR description must
    state "no production code changed."
HEARTBEAT: append timestamp every ~5min to .claude/agent-status/<id>.log
```

### Wave B — execution mode

- **`/dispatch`** in ad-hoc mode (4 explicit tasks, not `--from-backlog`, since
  this plan dictates the exact files).
- Each subagent uses `/tdd-ship` discipline — failing tests committed first,
  then implementation (or in this case, just confirming the targeted code paths
  behave as the test asserts; if a test surfaces a real bug, escalate, do not
  silently fix).
- Per PR: local green → `gh pr create` → `gh pr edit <num> --add-label queue` →
  15-min wakeup.

### Wave B — risks

- **TD-77 / TD-79 may surface real bugs** in the cross-org boundaries. If a
  subagent's failing test reveals a production bug rather than a coverage gap,
  STOP and escalate — do not bundle the prod fix into a test PR.
- **Stripe API version drift (TD-80c).** If `"2026-03-25.dahlia"` is no longer
  current at run time, the test SHOULD fail and the right answer is to bump
  the pinned version in `lib/stripe.ts` in a sibling PR, not loosen the test.

---

## Cross-wave invariants

- **No `BACKLOG.md` edits in feature PRs.** Status flips happen via
  `/backlog-sync` or dedicated `chore(backlog)` PRs. (Wave A4 covers UX-035.)
- **Independent base SHAs.** Wave B branches off current `origin/main`; Wave A
  branches off `origin/main` AFTER #244/245/246 land. No cross-wave rebases.
- **No file overlap.** Wave A touches `DashboardClient.tsx` + one new dashboard
  test + one e2e spec. Wave B touches four brand-new test files in repo paths
  Wave A never reaches.
- **Mergify queue label by default** on every PR (`gh pr edit <num> --add-label queue`),
  followed by a 15-min wakeup per CLAUDE.md.
- **Local green gates `gh pr ready`** in both waves — never bypass the
  pre-commit / typecheck hooks.

## Suggested running order

- Wave B can start immediately in its own session (does not depend on the
  in-flight PRs).
- Wave A's session should poll #244/245/246 first; if any are still UNSTABLE
  due to E2E, the Wave A session can opportunistically take A3 first
  (the E2E selector fix), since landing A3 will unblock all three sibling
  PRs and Wave A's own PR.
