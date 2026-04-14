import { Page, Browser } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export async function clearMailpit(): Promise<void> {
  try {
    await fetch("http://127.0.0.1:54324/api/v1/messages", { method: "DELETE" });
  } catch {}
}

export async function getOtpFromMailpit(email: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 1500));
  const res = await fetch("http://127.0.0.1:54324/api/v1/messages");
  const data = await res.json();
  const messages = data?.messages ?? [];
  const msg = messages.find((m: any) =>
    m.To?.some((t: any) => t.Address === email),
  );
  if (!msg) throw new Error("No email found for " + email);
  const match = msg.Snippet?.match(/code:\s*(\d{6})/);
  if (!match) throw new Error("No OTP in: " + msg.Snippet);
  return match[1];
}

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/signin");
  await page.fill('[placeholder="you@example.com"]', email);
  await page.click("text=Continue with email");
  await page.waitForSelector("text=Check your email");
  const otp = await getOtpFromMailpit(email);
  await page.fill('[placeholder="123456"]', otp);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }),
    page.click("text=Sign in"),
  ]);
}

// Navigate from the dashboard to the journal page, creating a care team first if needed.
export async function navigateToJournal(page: Page): Promise<void> {
  await Promise.race([
    page.waitForSelector('button:has-text("View care journal")', {
      timeout: 15000,
    }),
    page.waitForSelector('a:has-text("Set up a care team")', {
      timeout: 15000,
    }),
  ]);

  const hasCareTeam =
    (await page.locator('button:has-text("View care journal")').count()) > 0;

  if (!hasCareTeam) {
    await page.click('a:has-text("Set up a care team")');
    await page.waitForURL(/\/onboarding/, { timeout: 10000 });
    await page.fill("[name=recipientName]", "E2E Test Person");
    await page.fill("[name=orgName]", "E2E Test Family");
    await page.click("button[type=submit]");
    await page.waitForSelector('button:has-text("View care journal")', {
      timeout: 15000,
    });
  }

  await page.click('button:has-text("View care journal")');
  await page.waitForURL(/\/journal\//);
}

// Send an invite from the journal page and return the invite URL from the alert.
// The waitForEvent must be registered before the click that triggers the dialog.
export async function sendInviteAndGetUrl(
  page: Page,
  email: string,
  role: string,
): Promise<string> {
  await page.click("text=Invite someone");
  await page.fill("[type=email]", email);
  await page.selectOption("select", role);

  const dialogPromise = page.waitForEvent("dialog");
  await page.click("text=Send invite");
  const dialog = await dialogPromise;
  const match = dialog.message().match(/http[^\s]+/);
  await dialog.accept();

  if (!match)
    throw new Error("No URL found in invite dialog: " + dialog.message());
  return match[0];
}

// Accept a pending invite as a new user. The invitee must not already be signed in.
// Returns { page, ctx } — callers MUST call ctx.close() in a finally block.
export async function acceptInviteAsNewUser(
  browser: Browser,
  inviteUrl: string,
  inviteeEmail: string,
): Promise<{ page: Page; ctx: import("@playwright/test").BrowserContext }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(inviteUrl);
  await clearMailpit();
  await Promise.all([
    page.waitForURL(/\/signin/, { timeout: 10000 }),
    page.click("text=Accept invitation"),
  ]);

  await page.fill('[placeholder="you@example.com"]', inviteeEmail);
  await page.click("text=Continue with email");
  await page.waitForSelector("text=Check your email");
  const otp = await getOtpFromMailpit(inviteeEmail);
  await page.fill('[placeholder="123456"]', otp);

  // Redirected back to invite URL by DashboardClient pending invite bridge
  await Promise.all([
    page.waitForURL(/\/invite\//, { timeout: 15000 }),
    page.click("text=Sign in"),
  ]);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }),
    page.click("text=Accept invitation"),
  ]);

  return { page, ctx };
}

// Run axe-core accessibility checks and throw on serious/critical violations.
export async function checkA11y(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const violations = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  if (violations.length > 0) {
    throw new Error(
      `${violations.length} a11y violations:\n` +
        violations
          .map((v) => `[${v.impact}] ${v.id}: ${v.description}`)
          .join("\n"),
    );
  }
}
