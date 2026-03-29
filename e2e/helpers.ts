import { Page, expect } from '@playwright/test'

export async function clearMailpit(): Promise<void> {
  try {
    await fetch('http://127.0.0.1:54324/api/v1/messages', { method: 'DELETE' })
  } catch {}
}

export async function getOtpFromMailpit(email: string): Promise<string> {
  await new Promise(r => setTimeout(r, 1500))
  const res = await fetch('http://127.0.0.1:54324/api/v1/messages')
  const data = await res.json()
  const messages = data?.messages ?? []
  const msg = messages.find((m: any) =>
    m.To?.some((t: any) => t.Address === email)
  )
  if (!msg) throw new Error('No email found for ' + email)
  const match = msg.Snippet?.match(/code:\s*(\d{6})/)
  if (!match) throw new Error('No OTP in: ' + msg.Snippet)
  return match[1]
}

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/signin')
  await page.fill('[placeholder="you@example.com"]', email)
  await page.click('text=Continue with email')
  await page.waitForSelector('text=Check your email')
  const otp = await getOtpFromMailpit(email)
  await page.fill('[placeholder="123456"]', otp)
  await page.click('text=Sign in')
  await page.waitForURL(/\/dashboard/, { timeout: 10000 })
}