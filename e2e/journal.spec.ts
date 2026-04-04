import { test, expect } from '@playwright/test'
import { signIn, clearMailpit, navigateToJournal } from './helpers'

const TEST_EMAIL = 'e2e-journal@test.com'

test.beforeEach(async () => {
  await clearMailpit()
})

async function writeEntry(page: any, text: string) {
  const textarea = page.getByPlaceholder('Share how today went...')
  await textarea.click()
  await textarea.fill(text)
  await page.waitForSelector('text=Share update', { timeout: 3000 })
  await page.click('text=Share update')
  // Wait for the form to reset — setText('') is called after loadEvents() returns,
  // so an empty textarea means the entry is now in the DB and rendered in the timeline.
  await expect(textarea).toHaveValue('', { timeout: 12000 })
  await expect(page.getByText(text)).toBeVisible({ timeout: 5000 })
}

test('journal page loads after signing in', async ({ page }) => {
  await signIn(page, TEST_EMAIL)
  await navigateToJournal(page)
  await expect(page.getByPlaceholder('Share how today went...')).toBeVisible()
})

test('can write a journal entry', async ({ page }) => {
  await signIn(page, TEST_EMAIL)
  await navigateToJournal(page)
  await writeEntry(page, 'E2E test entry ' + Date.now())
})

test('coordinator sees entry form and invite button', async ({ page }) => {
  await signIn(page, TEST_EMAIL)
  await navigateToJournal(page)

  // Coordinator should see the entry form
  await expect(page.getByPlaceholder('Share how today went...')).toBeVisible()

  // Coordinator should see the invite button
  await expect(page.getByText('Invite someone')).toBeVisible()
})

test('can flag an entry for doctor and unflag it', async ({ page }) => {
  await signIn(page, TEST_EMAIL)
  await navigateToJournal(page)

  const entryText = 'Flag test entry ' + Date.now()
  await writeEntry(page, entryText)

  // The entry card should show a "Flag for doctor" button
  const entryCard = page.locator('[data-testid="journal-entry"]', { hasText: entryText })
  const flagButton = entryCard.getByText('Flag for doctor')
  await expect(flagButton).toBeVisible()

  // Click flag — badge should appear
  await flagButton.click()
  await expect(entryCard.getByText('Flagged for doctor')).toBeVisible({ timeout: 3000 })

  // "Unflag" button should now be shown
  const unflagButton = entryCard.getByText('Unflag')
  await expect(unflagButton).toBeVisible()

  // Click unflag — badge should disappear
  await unflagButton.click()
  await expect(entryCard.getByText('Flagged for doctor')).not.toBeVisible({ timeout: 3000 })
})

test('can react to a journal entry and toggle it off', async ({ page }) => {
  await signIn(page, TEST_EMAIL)
  await navigateToJournal(page)

  const entryText = 'Reaction test entry ' + Date.now()
  await writeEntry(page, entryText)

  // Wait for reactions to load (fetched after render)
  await page.waitForTimeout(1000)

  const entryCard = page.locator('[data-testid="journal-entry"]', { hasText: entryText })

  // Click the heart reaction
  const heartButton = entryCard.getByTitle('Heart')
  await expect(heartButton).toBeVisible()
  await heartButton.click()

  // Count should show 1
  await expect(heartButton.getByText('1')).toBeVisible({ timeout: 3000 })

  // Click again — should toggle off (count disappears)
  await heartButton.click()
  await expect(heartButton.getByText('1')).not.toBeVisible({ timeout: 3000 })
})

test('switching reactions replaces the previous one', async ({ page }) => {
  await signIn(page, TEST_EMAIL)
  await navigateToJournal(page)

  const entryText = 'Switch reaction test ' + Date.now()
  await writeEntry(page, entryText)

  await page.waitForTimeout(1000)

  const entryCard = page.locator('[data-testid="journal-entry"]', { hasText: entryText })

  // React with heart
  await entryCard.getByTitle('Heart').click()
  await expect(entryCard.getByTitle('Heart').getByText('1')).toBeVisible({ timeout: 3000 })

  // Switch to strong — heart count should drop back to 0, strong should show 1
  await entryCard.getByTitle('Strong').click()
  await expect(entryCard.getByTitle('Strong').getByText('1')).toBeVisible({ timeout: 3000 })
  await expect(entryCard.getByTitle('Heart').getByText('1')).not.toBeVisible({ timeout: 3000 })
})
