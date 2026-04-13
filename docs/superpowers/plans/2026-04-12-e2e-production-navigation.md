# E2E Production Navigation Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-targeted Playwright suite that reproduces and guards against navigation bugs on care-log.org, using saved session state to avoid OTP per test.

**Architecture:** A second Playwright config (`playwright.prod.config.ts`) points at `https://care-log.org` and loads `storageState` from `.playwright/session.json`. A one-time interactive setup script saves that session. Three spec files cover panel tab navigation, entry detail navigation, and dashboard/sign-out flows.

**Tech Stack:** Playwright, TypeScript, care-log.org production (Supabase auth, Next.js App Router with `?panel=` query params for tab state)

---

## Key Implementation Notes

**How tab navigation works in the app:**
- `AppTabBar` reads `?panel=` from the URL query string
- Clicking a tab calls `router.push("/journal/" + recipientId + "?panel=" + tabId)`
- Panel content in `JournalClient` is conditionally rendered based on `activeDestination` from `SidebarContext`, which reads the `panel` search param on mount
- **Likely bug:** if `recipientId` is `null` (e.g. the pathname doesn't match `/journal/[id]`), the tab click navigates to `/journal/null?panel=medications` instead of the correct URL

**Selectors to use:**
- Tab buttons: `button[aria-label="Journal"]`, `button[aria-label="Medications"]`, `button[aria-label="Team"]`, `button[aria-label="Shifts"]`, `button[aria-label="Documents"]`, `button[aria-label="More"]`
- Active tab: `button[aria-selected="true"]`
- Sign-out: `button[aria-label="Sign out"]`
- Journal entry form: `placeholder="Share how today went..."`
- Medications panel: text `"Medications"` (collapsed button heading)
- Team panel: text `"Care team"`
- Entry cards: `data-testid="journal-entry"`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `e2e/playwright.prod.config.ts` | Create | Second Playwright config targeting care-log.org |
| `e2e/setup/save-session.ts` | Create | Interactive one-time auth session saver |
| `e2e/navigation.spec.ts` | Create | Panel tab navigation tests (primary bug target) |
| `e2e/journal-detail.spec.ts` | Create | Entry detail page nav tests |
| `e2e/dashboard-nav.spec.ts` | Create | Dashboard ↔ journal, sign-out tests |
| `.gitignore` | Modify | Ignore `.playwright/session.json` |

---

## Task 1: Production Playwright config + gitignore

**Files:**
- Create: `e2e/playwright.prod.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create the production Playwright config**

```typescript
// e2e/playwright.prod.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    '**/navigation.spec.ts',
    '**/journal-detail.spec.ts',
    '**/dashboard-nav.spec.ts',
  ],
  fullyParallel: false,
  retries: 1,
  workers: 1,
  timeout: 30000,
  reporter: 'line',
  use: {
    baseURL: 'https://care-log.org',
    storageState: '.playwright/session.json',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: '**/setup/save-session.ts',
      use: { storageState: undefined },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: [],
    },
  ],
})
```

- [ ] **Step 2: Add session file to .gitignore**

Append to `.gitignore`:
```
# Playwright production session (contains auth cookies)
.playwright/
```

- [ ] **Step 3: Commit**

```bash
git add e2e/playwright.prod.config.ts .gitignore
git commit -m "feat(e2e): add production Playwright config targeting care-log.org"
```

---

## Task 2: Session setup script

**Files:**
- Create: `e2e/setup/save-session.ts`

- [ ] **Step 1: Create the session saver**

```typescript
// e2e/setup/save-session.ts
import { test } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const SESSION_PATH = path.join(process.cwd(), '.playwright', 'session.json')

test('save production session', async ({ page, context }) => {
  // Ensure output directory exists
  fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true })

  await page.goto('https://care-log.org/signin')
  await page.waitForSelector('[placeholder="you@example.com"]')

  // Pause — manually enter email, receive OTP, sign in
  // The test will resume once you click the "Resume" button in the Playwright Inspector
  console.log('\n🔑 Sign in at care-log.org in the browser window, then click Resume in the Playwright Inspector\n')
  await page.pause()

  // Confirm we landed on dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 30000 })
  console.log('✅ Signed in successfully — saving session')

  // Save cookies + localStorage
  const state = await context.storageState()
  fs.writeFileSync(SESSION_PATH, JSON.stringify(state, null, 2))
  console.log('✅ Session saved to', SESSION_PATH)
})
```

- [ ] **Step 2: Verify it runs (headed mode required)**

```bash
mkdir -p .playwright
npx playwright test --config=e2e/playwright.prod.config.ts --project=setup --headed
```

Expected: Browser window opens at care-log.org/signin. After manual sign-in and clicking Resume, `.playwright/session.json` is created.

- [ ] **Step 3: Commit**

```bash
git add e2e/setup/save-session.ts
git commit -m "feat(e2e): add production session saver (interactive, one-time)"
```

---

## Task 3: Navigation spec — panel tabs

**Files:**
- Create: `e2e/navigation.spec.ts`

This is the primary bug target. Each test clicks a tab button, verifies the URL changes to `?panel=<name>`, and verifies panel content is visible.

- [ ] **Step 1: Write the navigation spec**

```typescript
// e2e/navigation.spec.ts
import { test, expect } from '@playwright/test'

// Navigate to the journal page from dashboard — reused across all tests
async function goToJournal(page: any) {
  await page.goto('/dashboard')
  await page.waitForSelector('button:has-text("View care journal")', { timeout: 15000 })
  await page.click('button:has-text("View care journal")')
  await page.waitForURL(/\/journal\/[^/]+/, { timeout: 15000 })
  // Confirm default panel loaded
  await page.waitForSelector('[placeholder="Share how today went..."]', { timeout: 10000 })
}

test.describe('Panel tab navigation', () => {

  test('default panel is Journal — entry form visible', async ({ page }) => {
    await goToJournal(page)
    await expect(page.getByPlaceholder('Share how today went...')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Journal' })).toHaveAttribute('aria-selected', 'true')
  })

  test('Medications tab — panel heading visible and URL updated', async ({ page }) => {
    await goToJournal(page)
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await page.click('button[aria-label="Medications"]')
    await expect(page).toHaveURL(/[?&]panel=medications/, { timeout: 8000 })
    await expect(page.getByRole('button', { name: 'Medications' })).toHaveAttribute('aria-selected', 'true')
    // Panel renders its collapsed heading button
    await expect(page.getByRole('button', { name: /Medications/i }).last()).toBeVisible({ timeout: 5000 })
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0)
  })

  test('Team tab — care team heading visible and URL updated', async ({ page }) => {
    await goToJournal(page)
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await page.click('button[aria-label="Team"]')
    await expect(page).toHaveURL(/[?&]panel=team/, { timeout: 8000 })
    await expect(page.getByRole('button', { name: 'Team' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('Care team')).toBeVisible({ timeout: 5000 })
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0)
  })

  test('Shifts tab — panel content visible and URL updated', async ({ page }) => {
    await goToJournal(page)
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await page.click('button[aria-label="Shifts"]')
    await expect(page).toHaveURL(/[?&]panel=shifts/, { timeout: 8000 })
    await expect(page.getByRole('button', { name: 'Shifts' })).toHaveAttribute('aria-selected', 'true')
    // ShiftForm renders a "+ Schedule a shift" trigger regardless of data
    await expect(page.getByText(/Schedule a shift|Upcoming shifts/i)).toBeVisible({ timeout: 5000 })
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0)
  })

  test('Documents tab — panel content visible and URL updated', async ({ page }) => {
    await goToJournal(page)
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await page.click('button[aria-label="Documents"]')
    await expect(page).toHaveURL(/[?&]panel=documents/, { timeout: 8000 })
    await expect(page.getByRole('button', { name: 'Documents' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText(/Document vault/i)).toBeVisible({ timeout: 5000 })
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0)
  })

  test('More tab — panel content visible and URL updated', async ({ page }) => {
    await goToJournal(page)
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await page.click('button[aria-label="More"]')
    await expect(page).toHaveURL(/[?&]panel=more/, { timeout: 8000 })
    await expect(page.getByRole('button', { name: 'More' })).toHaveAttribute('aria-selected', 'true')
    // More panel renders OCR review + symptom panels
    await expect(page.getByText(/Symptom readings|Scan label/i)).toBeVisible({ timeout: 5000 })
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0)
  })

  test('tab navigation is reversible — can return to Journal from Medications', async ({ page }) => {
    await goToJournal(page)
    await page.click('button[aria-label="Medications"]')
    await expect(page).toHaveURL(/panel=medications/, { timeout: 8000 })

    await page.click('button[aria-label="Journal"]')
    await expect(page).toHaveURL(/panel=journal/, { timeout: 8000 })
    await expect(page.getByPlaceholder('Share how today went...')).toBeVisible({ timeout: 5000 })
  })

  test('URL panel param preserved on page reload', async ({ page }) => {
    await goToJournal(page)
    await page.click('button[aria-label="Team"]')
    await expect(page).toHaveURL(/panel=team/, { timeout: 8000 })

    await page.reload()
    await expect(page).toHaveURL(/panel=team/)
    await expect(page.getByText('Care team')).toBeVisible({ timeout: 10000 })
  })

})
```

- [ ] **Step 2: Run navigation tests against production**

```bash
npx playwright test --config=e2e/playwright.prod.config.ts e2e/navigation.spec.ts --headed
```

Expected: All 7 tests pass. If any tab test fails with URL showing `/journal/null?panel=medications` or similar, that confirms the `recipientId` extraction bug in `AppTabBar`.

- [ ] **Step 3: Commit**

```bash
git add e2e/navigation.spec.ts
git commit -m "feat(e2e): production panel tab navigation tests"
```

---

## Task 4: Journal detail spec

**Files:**
- Create: `e2e/journal-detail.spec.ts`

- [ ] **Step 1: Write the journal detail spec**

```typescript
// e2e/journal-detail.spec.ts
import { test, expect } from '@playwright/test'

async function goToJournal(page: any) {
  await page.goto('/dashboard')
  await page.waitForSelector('button:has-text("View care journal")', { timeout: 15000 })
  await page.click('button:has-text("View care journal")')
  await page.waitForURL(/\/journal\/[^/]+/, { timeout: 15000 })
  await page.waitForSelector('[placeholder="Share how today went..."]', { timeout: 10000 })
}

test.describe('Journal entry detail navigation', () => {

  test('clicking an entry card navigates to detail page', async ({ page }) => {
    await goToJournal(page)
    // Wait for at least one entry to appear in the timeline
    const firstEntry = page.locator('[data-testid="journal-entry"]').first()
    await expect(firstEntry).toBeVisible({ timeout: 10000 })

    const journalUrl = page.url()
    await firstEntry.click()
    await expect(page).toHaveURL(/\/entry\//, { timeout: 10000 })
    // URL must not still be the journal page
    expect(page.url()).not.toBe(journalUrl)
  })

  test('detail page renders entry content', async ({ page }) => {
    await goToJournal(page)
    const firstEntry = page.locator('[data-testid="journal-entry"]').first()
    await expect(firstEntry).toBeVisible({ timeout: 10000 })
    // Capture the entry text before navigating
    const entryText = await firstEntry.textContent()

    await firstEntry.click()
    await expect(page).toHaveURL(/\/entry\//, { timeout: 10000 })
    // The entry text should appear on the detail page
    if (entryText && entryText.trim().length > 5) {
      await expect(page.getByText(entryText.trim().slice(0, 40))).toBeVisible({ timeout: 8000 })
    }
  })

  test('browser back from detail returns to journal', async ({ page }) => {
    await goToJournal(page)
    const journalUrl = page.url()

    const firstEntry = page.locator('[data-testid="journal-entry"]').first()
    await expect(firstEntry).toBeVisible({ timeout: 10000 })
    await firstEntry.click()
    await expect(page).toHaveURL(/\/entry\//, { timeout: 10000 })

    await page.goBack()
    await expect(page).toHaveURL(journalUrl, { timeout: 10000 })
    await expect(page.getByPlaceholder('Share how today went...')).toBeVisible({ timeout: 5000 })
  })

  test('in-app back button on detail page returns to journal', async ({ page }) => {
    await goToJournal(page)

    const firstEntry = page.locator('[data-testid="journal-entry"]').first()
    await expect(firstEntry).toBeVisible({ timeout: 10000 })
    await firstEntry.click()
    await expect(page).toHaveURL(/\/entry\//, { timeout: 10000 })

    // In-app back — look for a back button or link
    const backButton = page.getByRole('link', { name: /back/i })
      .or(page.getByRole('button', { name: /back/i }))
    await expect(backButton).toBeVisible({ timeout: 5000 })
    await backButton.click()
    await expect(page).toHaveURL(/\/journal\//, { timeout: 10000 })
  })

})
```

- [ ] **Step 2: Run detail tests against production**

```bash
npx playwright test --config=e2e/playwright.prod.config.ts e2e/journal-detail.spec.ts --headed
```

Expected: All 4 tests pass. If "detail page renders entry content" fails, the entry detail page is rendering blank — a separate bug from tab navigation.

- [ ] **Step 3: Commit**

```bash
git add e2e/journal-detail.spec.ts
git commit -m "feat(e2e): production journal entry detail navigation tests"
```

---

## Task 5: Dashboard navigation and sign-out spec

**Files:**
- Create: `e2e/dashboard-nav.spec.ts`

- [ ] **Step 1: Write the dashboard nav spec**

```typescript
// e2e/dashboard-nav.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Dashboard and sign-out navigation', () => {

  test('session restores and dashboard loads', async ({ page }) => {
    await page.goto('/dashboard')
    // Should land on dashboard, not be redirected to /signin
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
    await expect(page.getByText('Your care teams')).toBeVisible({ timeout: 10000 })
  })

  test('"View care journal" navigates to journal page', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('button:has-text("View care journal")', { timeout: 15000 })
    await page.click('button:has-text("View care journal")')
    await expect(page).toHaveURL(/\/journal\/[^/]+/, { timeout: 15000 })
    await expect(page.getByPlaceholder('Share how today went...')).toBeVisible({ timeout: 10000 })
  })

  test('Journal tab button navigates back to dashboard from journal', async ({ page }) => {
    // Navigate to journal first
    await page.goto('/dashboard')
    await page.waitForSelector('button:has-text("View care journal")', { timeout: 15000 })
    await page.click('button:has-text("View care journal")')
    await expect(page).toHaveURL(/\/journal\//, { timeout: 15000 })

    // The AppTabBar has no "Dashboard" tab — navigating away from /journal happens
    // by clicking the app logo or using browser navigation. Check what's available.
    // Try the logo/home link first:
    const homeLink = page.getByRole('link', { name: /carelog|home/i })
      .or(page.getByAltText(/logo/i))
    if (await homeLink.count() > 0) {
      await homeLink.first().click()
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    } else {
      // Fallback: browser back
      await page.goBack()
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    }
    await expect(page.getByText('Your care teams')).toBeVisible({ timeout: 10000 })
  })

  test('sign-out redirects to /signin', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('button[aria-label="Sign out"]', { timeout: 15000 })
    await page.click('button[aria-label="Sign out"]')
    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 })
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
  })

  test('signed-out user cannot access /dashboard', async ({ browser }) => {
    // Use a fresh context with no session state
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    try {
      await page.goto('https://care-log.org/dashboard')
      await expect(page).toHaveURL(/\/signin/, { timeout: 10000 })
    } finally {
      await ctx.close()
    }
  })

})
```

- [ ] **Step 2: Run dashboard nav tests against production**

```bash
npx playwright test --config=e2e/playwright.prod.config.ts e2e/dashboard-nav.spec.ts --headed
```

Expected: All 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/dashboard-nav.spec.ts
git commit -m "feat(e2e): production dashboard navigation and sign-out tests"
```

---

## Task 6: Run full production suite and document findings

- [ ] **Step 1: Run all production tests**

```bash
npx playwright test --config=e2e/playwright.prod.config.ts
```

- [ ] **Step 2: Capture any failures**

If any test fails:
- Note which test, which assertion, and what the actual URL/element state was
- For tab navigation failures: check whether the URL shows `/journal/null?panel=medications` — if so, the bug is in `AppTabBar.tsx` at line 35-46 where `recipientId` is extracted from `pathname`
- For blank panel failures: check browser console output captured by the test

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(e2e): complete production navigation test suite"
```
