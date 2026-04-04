import { test, expect } from '@playwright/test'
import { signIn, clearMailpit, getOtpFromMailpit, navigateToJournal, sendInviteAndGetUrl } from './helpers'

const COORDINATOR_EMAIL = 'e2e-coordinator@test.com'
const INVITEE_EMAIL     = 'e2e-invitee@test.com'

test.beforeEach(async () => {
  await clearMailpit()
})

test('coordinator can invite a new user who accepts after signing in', async ({ browser }) => {
  const coordinatorCtx  = await browser.newContext()
  const inviteeCtx      = await browser.newContext()
  const coordinatorPage = await coordinatorCtx.newPage()
  const inviteePage     = await inviteeCtx.newPage()

  try {
    // Step 1: Coordinator signs in and navigates to the journal
    await signIn(coordinatorPage, COORDINATOR_EMAIL)
    await navigateToJournal(coordinatorPage)
    await expect(coordinatorPage.getByText('Invite someone')).toBeVisible()

    // Step 2: Send the invite and capture the URL
    const inviteUrl = await sendInviteAndGetUrl(coordinatorPage, INVITEE_EMAIL, 'caregiver')
    expect(inviteUrl).toMatch(/\/invite\//)

    // Step 3: Invitee visits the invite URL while not signed in
    await inviteePage.goto(inviteUrl)
    await expect(inviteePage.getByText('You have been invited to join a care team')).toBeVisible()
    await expect(inviteePage.getByText('Caregiver')).toBeVisible()

    // Step 4: Invitee clicks Accept — redirected to sign-in (not signed in yet)
    await clearMailpit()
    await inviteePage.click('text=Accept invitation')
    await inviteePage.waitForURL(/\/signin/, { timeout: 10000 })

    // Step 5: Invitee signs in — should bounce BACK to invite URL, not dashboard
    await inviteePage.fill('[placeholder="you@example.com"]', INVITEE_EMAIL)
    await inviteePage.click('text=Continue with email')
    await inviteePage.waitForSelector('text=Check your email')
    const otp = await getOtpFromMailpit(INVITEE_EMAIL)
    await inviteePage.fill('[placeholder="123456"]', otp)
    await inviteePage.click('text=Sign in')
    await inviteePage.waitForURL(/\/invite\//, { timeout: 15000 })
    await expect(inviteePage.getByText('You have been invited to join a care team')).toBeVisible()

    // Step 6: Accept the invite now that they are signed in
    await inviteePage.click('text=Accept invitation')
    await expect(inviteePage.getByText('You have joined the team')).toBeVisible({ timeout: 8000 })
    await inviteePage.waitForURL(/\/dashboard/, { timeout: 10000 })

    // Step 7: Coordinator's team panel should now show 2 members
    await coordinatorPage.reload()
    await expect(coordinatorPage.getByText('Care team')).toBeVisible({ timeout: 15000 })
    await expect(coordinatorPage.getByText('2 members')).toBeVisible({ timeout: 5000 })
  } finally {
    await coordinatorCtx.close()
    await inviteeCtx.close()
  }
})

test('invite page shows error for expired or invalid token', async ({ page }) => {
  await page.goto('/invite/invalid-token-that-does-not-exist')
  await expect(page.getByRole('heading', { name: 'Invite not found' })).toBeVisible({ timeout: 8000 })
})

test('invite page shows wrong-email error when signed in as different user', async ({ page }) => {
  await signIn(page, COORDINATOR_EMAIL)
  await navigateToJournal(page)

  const uniqueEmail = 'wrong-email-' + Date.now() + '@test.com'
  const inviteUrl = await sendInviteAndGetUrl(page, uniqueEmail, 'supporter')

  await page.goto(inviteUrl)
  await page.click('text=Accept invitation')
  await expect(page.getByText('You are signed in as')).toBeVisible({ timeout: 5000 })
})
