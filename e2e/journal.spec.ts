import { test, expect } from '@playwright/test'
import { signIn, clearMailpit } from './helpers'

const TEST_EMAIL = 'e2e-journal@test.com'

test.beforeEach(async () => {
  await clearMailpit()
})

async function navigateToJournal(page: any) {
  // Wait for dashboard to fully load — it's client-side rendered
  await page.waitForTimeout(2000)

  const hasCareTeam = await page.locator('text=View care journal').count() > 0

  if (!hasCareTeam) {
    // Find and click the set up button
    await page.click('button:has-text("Set up a care team")')
    await page.waitForURL(/\/onboarding/)
    await page.fill('[name=recipientName]', 'E2E Test Person')
    await page.fill('[name=orgName]', 'E2E Test Family')
    await page.click('text=Create care team')
    await page.waitForURL(/\/dashboard/)
    await page.waitForTimeout(2000)
  }

  await page.click('button:has-text("View care journal")')
  await page.waitForURL(/\/journal\//)
}

test('journal page loads after signing in', async ({ page }) => {
  await signIn(page, TEST_EMAIL)
  await navigateToJournal(page)
  await expect(page.getByPlaceholder('Share how today went...')).toBeVisible()
})

test('can write a journal entry', async ({ page }) => {
  await signIn(page, TEST_EMAIL)
  await navigateToJournal(page)

  const entryText = 'E2E test entry ' + Date.now()
  const textarea = page.getByPlaceholder('Share how today went...')
  await textarea.click()
  await textarea.fill(entryText)
  await page.waitForSelector('text=Share update', { timeout: 3000 })
  await page.click('text=Share update')

  await expect(page.getByText(entryText)).toBeVisible({ timeout: 8000 })
})