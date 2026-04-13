# E2E Production Navigation Tests — Design Spec

**Date:** 2026-04-12
**Status:** Approved

---

## Problem

Navigation within the team journal page (`/journal/[recipientId]`) is broken in production. Users cannot reliably switch between panel tabs (Journal, Medications, Documents, Symptoms, etc.). Additional navigation regressions may exist elsewhere. The existing E2E suite runs only against localhost and cannot reproduce production-specific failures.

---

## Approach

Session-first, production-targeted Playwright suite. A one-time interactive setup script signs in as the test account (`brady.grapentine@gmail.com`) via OTP and saves cookies to `.playwright/session.json`. All tests load that stored session — no OTP interaction per test. Tests run against `https://care-log.org`.

Session file is committed to `.gitignore` and stored as a GitHub Actions secret for CI use.

---

## Architecture

### New files

```
e2e/
  playwright.prod.config.ts     # second config pointing at care-log.org + storageState
  setup/
    save-session.ts             # interactive: sign in once, save storageState
  navigation.spec.ts            # panel tab navigation — primary bug target
  journal-detail.spec.ts        # entry detail page: load, back nav, content
  dashboard-nav.spec.ts         # dashboard → journal → back, sign-out
```

### Existing files — unchanged

`playwright.config.ts` continues pointing at `localhost:3000` for local/CI use. New `playwright.prod.config.ts` targets production.

---

## Session Setup

`e2e/setup/save-session.ts` — run once manually:

```bash
npx playwright test --config=e2e/playwright.prod.config.ts --project=setup
```

Steps:
1. Opens `https://care-log.org/signin` in headed browser
2. Pauses for manual OTP entry (uses `page.pause()`)
3. Waits for `/dashboard` redirect confirming successful auth
4. Saves `context.storageState()` to `.playwright/session.json`

Session persists ~1 week (Supabase default JWT expiry). Re-run when expired.

---

## Test Coverage

### `navigation.spec.ts` — primary target

Tests run against `/journal/[recipientId]` of the test user's first care team.

| Test | What it catches |
|------|----------------|
| Journal tab renders entry form | Broken default panel |
| Clicking Medications tab loads panel | Tab nav broken |
| Clicking Documents tab loads panel | Tab nav broken |
| Clicking Symptoms tab loads panel | Tab nav broken |
| Clicking Expenses tab loads panel | Tab nav broken |
| Clicking Team tab loads panel | Tab nav broken |
| Active tab has visible indicator | CSS/state regression |
| Navigating away and back preserves active tab | State lost on re-render |

Each tab test: click tab → assert panel heading visible → assert no console errors.

### `journal-detail.spec.ts`

| Test | What it catches |
|------|----------------|
| Clicking a journal entry card navigates to `/entry/` | Card click broken |
| Detail page shows entry content | Blank detail page |
| Browser back returns to journal page | Back nav broken |
| Back button (in-app) returns to journal | In-app back broken |

### `dashboard-nav.spec.ts`

| Test | What it catches |
|------|----------------|
| Dashboard loads after session restore | Session not persisting |
| "View care journal" navigates to journal | Dashboard button broken |
| Sidebar link navigates back to dashboard | Sidebar nav broken |
| Sign-out redirects to `/signin` | Auth guard broken |
| Signed-out user redirected from `/dashboard` | Protected route broken |

---

## Production Config (`playwright.prod.config.ts`)

```ts
export default defineConfig({
  testDir: './e2e',
  testMatch: ['navigation.spec.ts', 'journal-detail.spec.ts', 'dashboard-nav.spec.ts'],
  use: {
    baseURL: 'https://care-log.org',
    storageState: '.playwright/session.json',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: 'setup/save-session.ts', use: { storageState: undefined } },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
```

---

## Running

```bash
# First-time setup (headed, interactive)
npx playwright test --config=e2e/playwright.prod.config.ts --project=setup --headed

# Run production suite
npx playwright test --config=e2e/playwright.prod.config.ts

# Run only navigation tests
npx playwright test --config=e2e/playwright.prod.config.ts e2e/navigation.spec.ts
```

---

## What's Out of Scope

- Multi-user role tests against production (avoid creating real invite noise)
- Billing/Stripe flows (real money)
- Writing/mutating care data (tests are read-only where possible; journal entry writes use unique timestamped text and don't clean up)
- Mobile viewport testing (first pass desktop only)

---

## Success Criteria

1. `save-session.ts` setup script successfully saves auth cookies in one manual run
2. All navigation tests pass against production
3. Specific tab navigation bug is either reproduced (test fails, identifying root cause) or confirmed fixed (all tabs pass)
4. No test writes destructive data to the production account
