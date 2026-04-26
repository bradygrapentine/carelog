---
name: live-test
description: Drive the local stack (Supabase + Next.js) in a real browser via chrome-devtools-mcp to walk a user flow end-to-end. Captures page snapshots, console errors, network failures, Supabase logs, DB row diffs, and a selector-vs-DOM diff against a Playwright spec. Use to investigate failing E2E tests, validate selectors before writing tests, or reproduce a UX bug locally without writing throwaway code. Inputs: (a) path to an `e2e/*.spec.ts` file to validate, OR (b) a freeform flow description like "sign in, create journal entry with mood=Good, verify badge renders".
---

# /live-test — interactive flow investigation

Replaces the "write a Playwright spec → push → wait 5 min for CI → read trace" loop with a live browser walk that runs in seconds. Captures structured evidence at every step so you don't have to re-run when a different question comes up.

Born from the 2026-04-26 TD-48 debug session: the same investigation that took a dozen CI iterations was solved in 10 minutes by driving the local stack manually. This skill encodes that loop.

## When to use

- An E2E test is failing and the trace is ambiguous
- You're about to write a new E2E test and want to validate selectors against the actual DOM first
- A user-reported UX bug that you can't repro from the description alone
- A page snapshot from CI shows an unexpected element (overlay, missing button, wrong text) and you want to see it live
- Brand/copy drift suspected (e.g. "tests reference `Carelog`, app shows `CareSync`")
- Selector drift suspected (`button:has-text(...)` against an element refactored to a `<div>`)

## When NOT to use

- Genuinely non-deterministic failures (timing flakes, hydration races) — local won't reproduce reliably; use trace artifacts and re-run analysis instead
- CI-environment-only bugs (e.g. JWT crypto failures from CLI rotation) — local Supabase often has different env than CI
- Pure backend logic with no UI — write a test or use `supabase` CLI directly

## Inputs

Two forms:

**(a) Spec file** — `/live-test e2e/auth-journal.spec.ts` or `/live-test e2e/auth-journal.spec.ts:30` (specific test). The skill reads the spec, extracts the user flow (signIn → ensureCareTeam → click → assert), walks it in the browser, and compares each `expect(...)` against the actual DOM at that step. Output flags every drift.

**(b) Freeform description** — `/live-test sign in as e2e@test.com, create a journal entry with mood=Good, verify the mood badge renders in the timeline`. The skill parses the steps and walks them. No assertion comparison — just snapshots + log capture at each step.

## Pre-flight

Run these checks. If any fail, fix and re-run before proceeding.

```bash
# 1. Docker running (Supabase needs it)
docker info > /dev/null 2>&1 || { echo "ERR: start Docker Desktop"; exit 1; }

# 2. Supabase running, or boot it
curl -sf http://127.0.0.1:54321/rest/v1/ > /dev/null 2>&1 || supabase start

# 3. Dev server running, or boot it (background)
curl -sf http://localhost:3000 > /dev/null 2>&1 || (pnpm web &)

# 4. Wait for dev server health
until curl -sf http://localhost:3000 > /dev/null 2>&1; do sleep 1; done

# 5. Mailpit reachable
curl -sf http://127.0.0.1:54324/api/v1/messages > /dev/null 2>&1 || \
  { echo "ERR: Mailpit (54324) not reachable; supabase start may need re-running"; exit 1; }
```

Load chrome-devtools-mcp tools via ToolSearch before the first browser call:
`select:mcp__plugin_chrome-devtools-mcp_chrome-devtools__new_page,...navigate_page,...take_snapshot,...click,...fill,...wait_for,...list_console_messages,...list_network_requests`

## Execution recipe

For every step, in order:

1. **Take a snapshot** before the action — captures the a11y tree as the user/test sees it.
2. **Perform the action** (click, fill, navigate). Use the `uid` from the snapshot, never raw selectors.
3. **wait_for** a known terminal state (text on next page, error toast, etc.) with a tight timeout — never bare sleep.
4. **Take a snapshot** after — diff against pre-snapshot for unexpected changes.
5. **Pull console + network** since last navigation. Filter by error/warn level. Network failures (4xx, 5xx, timeouts) must surface verbatim.
6. **For DB-modifying actions** (form submits, deletes), query the local Postgres before & after to confirm the row landed.

### Sign-in OTP recipe (copy-paste)

Local Supabase emails go to Mailpit. Poll, parse, fill — never sleep.

```javascript
// via mcp__plugin_context-mode_context-mode__ctx_execute
const r = await fetch("http://127.0.0.1:54324/api/v1/messages");
const d = await r.json();
const msg = (d.messages || []).find(m =>
  (m.To || []).some(t => t.Address === EMAIL));
if (!msg) { console.log("NO_EMAIL"); process.exit(0); }
const r2 = await fetch(`http://127.0.0.1:54324/api/v1/message/${msg.ID}`);
const body = await r2.json();
const text = (body.Text || "") + " " + (msg.Snippet || "");
const m = text.match(/\b(\d{6})\b/);
console.log(m ? m[1] : "NO_OTP_FOUND");
```

### Supabase log capture

When PostgREST or Auth errors are suspected, pull container logs at the moment of failure:

```bash
docker logs $(docker ps --filter name=supabase_rest -q) --since 1m 2>&1 | tail -50
docker logs $(docker ps --filter name=supabase_auth -q) --since 1m 2>&1 | tail -50
```

### DB diff at action boundaries

```bash
# Before action
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -tAc \
  "SELECT id, name, created_at FROM organizations ORDER BY created_at DESC LIMIT 3" > /tmp/before.txt

# (perform action)

# After action
psql "..." -tAc "SELECT id, name, created_at FROM organizations ORDER BY created_at DESC LIMIT 3" > /tmp/after.txt
diff /tmp/before.txt /tmp/after.txt
```

### Selector-vs-DOM diff (spec-file mode only)

For each `page.locator(...)`, `page.getBy*(...)`, or `expect(...).toBeVisible()` in the spec, run a quick parallel check at the matching step:

```javascript
// via ctx_execute or direct snapshot inspection
// The snapshot already lists every queryable element + its uid + role + name + state.
// Compare each test selector against the snapshot:
//   - text="X"             → snapshot must have a node with name == "X" or StaticText "X"
//   - button:has-text("X") → snapshot must have a button with name "X" (NOT just any element)
//   - [class*="x"]         → snapshot can't represent CSS — must check page source
//   - [data-testid="x"]    → snapshot doesn't include data-* attrs; need page.evaluate
//   - getByRole("button")  → snapshot's role field
```

When the test selector wouldn't match the actual snapshot, that's drift — flag it.

## Output report

Always emit a single structured report. Path: `/tmp/live-test-<unix-ts>.md`. Print path at end so user can re-open.

```markdown
# /live-test report — <flow name> — <timestamp>

## Inputs
- Mode: spec-file | freeform
- Spec / description: <path or text>
- Started: <ISO time>
- Stack: Supabase CLI <version>, Next.js running on :3000

## Steps walked
| # | Action | Result | Snapshot | Notes |
|---|---|---|---|---|
| 1 | navigate /signin | OK | snap-01 | banner shows "CareSync" |
| 2 | fill email | OK | — | — |
| 3 | click "Continue" | OK | snap-02 | OTP screen rendered in 220ms |
| 4 | poll mailpit | OK | — | OTP=086191 in 1.2s |
| 5 | fill OTP, click Sign in | OK | snap-03 | redirected to /dashboard in 1.8s |

## Findings (categorized)

### 🔴 Drift — test will fail
- `auth.spec.ts:12` — `expect(getByText('Carelog'))`; actual page text is `CareSync`. Fix: rename in test.
- `ai-assistant.spec.ts:25` — `getByRole('button',{name:'Open AI Assistant'}).click()` resolved to QuickLog button instead (uid=26_59 expanded). Hit-test collision; AIFab at right-4 z-50 sits inside QuickLogFab at right-6 z-50.

### 🟡 Brittle — test passes but selector is fragile
- `[class*="mood"]` matches form mood-tag buttons today only because their classes contain "bg-mood-…"; will break on next class refactor. Suggest data-mood attribute.

### 🟢 Production bugs noticed
- DashboardClient.tsx:82 still says "Share Carelog with them" — incomplete rename.

## Console errors during walk
<verbatim list, deduped>

## Network failures during walk
<list of non-2xx responses, with method+URL+status+brief body>

## Supabase log snippets
- supabase_rest (last 50 lines): ...
- supabase_auth (last 50 lines): ...

## DB diffs
- `organizations`: +1 row inserted at step 6 (id=…, name="Investigation Family")
- `memberships`: +1 row at step 6 (user_id=…, org_id=…, role="owner")

## Recommended next actions
- 4 brand-rename fixes: auth.spec.ts (×2), marketing.spec.ts (×3), ui-smoke.spec.ts, brief.spec.ts (×2)
- 1 selector fix: ai-assistant.spec.ts FAB collision — add data-testid + bump z-index OR move AIFab off QuickLog's footprint
- 1 production fix: dashboard "Refer a family" copy
```

## Hard rules

- **Never** auto-fix the code from this skill — emit the report, let the user choose. Investigation ≠ implementation.
- **Never** skip the snapshot step — even if you "know" the selector. The reason this skill exists is that snapshots refute assumptions.
- **Always** capture network + console after each navigation, not just at the end. Errors that fire mid-flow are easy to miss in a final dump.
- **Always** clean up after the run: leave the dev server running (it's slow to boot), close the page only if the user asked.
- **Pre-flight is mandatory** — if Docker / Supabase / dev server / Mailpit isn't healthy, fix that first. Don't half-run.

## Common patterns this skill catches

| Pattern | How it surfaces in the report |
|---|---|
| Brand rename drift (Carelog → CareSync) | Snapshot text ≠ test assertion text |
| Element type drift (button → div) | Test uses `button:has-text(...)`; snapshot has StaticText, no button role |
| FAB / overlay collision | Click on element A activates element B in console/network log |
| Class-substring selector | Test uses `[class*="x"]`; live page source has classes that don't contain "x" |
| Missing data-testid | Test uses testid X; page.evaluate finds no node with that attr |
| Auth state stale | Sign-in flow loops on /signin instead of redirecting |
| Network 5xx during action | network capture flags response.status >= 500 |
| DB write didn't land | DB diff is empty after a form submit |
| Log error not surfaced in UI | supabase_auth or supabase_rest log has ERROR not visible to user |

## See also

- `docs/project-info/runbooks/E2E_FAILURE_DIAGNOSIS.md` — the layered-failure runbook this skill operationalizes
- `e2e/CLAUDE.md` — local Playwright running
- `e2e/helpers.ts` — canonical sign-in / ensureCareTeam / OTP poll helpers (reuse their logic; don't duplicate)
- chrome-devtools-mcp plugin (`/mcp` to confirm loaded)
