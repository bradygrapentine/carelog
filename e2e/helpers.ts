import { Page, Browser } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export async function clearMailpit(): Promise<void> {
  try {
    await fetch("http://127.0.0.1:54324/api/v1/messages", { method: "DELETE" });
  } catch {}
}

// Poll Mailpit for an OTP email rather than fixed-sleeping. Survives cold-cache
// CI where the email may take up to 10s to arrive. Returns the 6-digit code.
export async function getOtpFromMailpit(
  email: string,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const pollIntervalMs = options.pollIntervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  let lastError = "no email yet";
  while (Date.now() < deadline) {
    try {
      const res = await fetch("http://127.0.0.1:54324/api/v1/messages");
      const data = (await res.json()) as { messages?: Array<{
        Snippet?: string;
        To?: Array<{ Address?: string }>;
      }> };
      const messages = data?.messages ?? [];
      const msg = messages.find((m) =>
        m.To?.some((t) => t.Address === email),
      );
      if (msg) {
        // Match common Supabase OTP email phrasings:
        //   "Your code: 123456"
        //   "code is 123456"
        //   "verification code: 123456"
        // The 6-digit group must be word-boundaried so we don't grab unrelated
        // 6-digit substrings in URLs / timestamps.
        const match = msg.Snippet?.match(
          /(?:code|verification code|otp)[\s:]*?(\d{6})\b/i,
        );
        if (match) return match[1];
        lastError = `email found but no OTP in snippet: ${msg.Snippet?.slice(0, 120)}`;
      }
    } catch (err) {
      lastError = `fetch failed: ${err instanceof Error ? err.message : String(err)}`;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  throw new Error(
    `getOtpFromMailpit timed out after ${timeoutMs}ms for ${email}: ${lastError}`,
  );
}

// SignIn flow: enter email → wait for OTP email → enter code → wait for /dashboard.
//
// Selector hardening (TD-39): the signin page has THREE elements containing
// the substring "Sign in" — heading "Sign in to CareSync", form button "Sign in",
// and MarketingNav link. `text=Sign in` matched ambiguously and could click the
// wrong element, leaving the form unsubmitted and waitForURL spinning until
// timeout. Use explicit role + exact name + form scoping instead.
export async function signIn(page: Page, email: string): Promise<void> {
  await clearMailpit();
  await page.goto("/signin");

  // Email step — exact button name to avoid the "Sending code..." disabled state.
  await page.getByLabel("Email address").fill(email);
  await page
    .getByRole("button", { name: /^Continue with email$/ })
    .click();
  await page.getByText("Check your email", { exact: false }).waitFor();

  // OTP step.
  const otp = await getOtpFromMailpit(email);
  await page.getByPlaceholder("123456").fill(otp);

  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 30_000 }),
    // Scope the click to a button (not the heading or MarketingNav link).
    page.getByRole("button", { name: /^Sign in$/ }).click(),
  ]);
}

// Ensure the signed-in user has a care team / org membership. The (app)/layout
// guards membership-dependent surfaces (e.g. AIAssistantProvider only mounts
// when orgId is non-null) so any test that asserts on those surfaces must call
// this in its beforeEach. Idempotent: returns immediately if a team already
// exists. Leaves the page on /dashboard.
export async function ensureCareTeam(page: Page): Promise<void> {
  await page.goto("/dashboard");
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
  if (hasCareTeam) return;

  await page.click('a:has-text("Set up a care team")');
  await page.waitForURL(/\/onboarding/, { timeout: 10000 });
  await page.fill("[name=recipientName]", "E2E Test Person");
  await page.fill("[name=orgName]", "E2E Test Family");
  await page.click("button[type=submit]");
  // Onboarding redirects back to /dashboard with the team now seeded.
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  await page.waitForSelector('button:has-text("View care journal")', {
    timeout: 15000,
  });
}

// Navigate from the dashboard to the journal page, creating a care team first if needed.
export async function navigateToJournal(page: Page): Promise<void> {
  await ensureCareTeam(page);
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
    page
      .getByRole("button", { name: /^Accept invitation$/ })
      .click(),
  ]);

  await page.getByLabel("Email address").fill(inviteeEmail);
  await page
    .getByRole("button", { name: /^Continue with email$/ })
    .click();
  await page.getByText("Check your email", { exact: false }).waitFor();
  const otp = await getOtpFromMailpit(inviteeEmail);
  await page.getByPlaceholder("123456").fill(otp);

  // Redirected back to invite URL by DashboardClient pending invite bridge
  await Promise.all([
    page.waitForURL(/\/invite\//, { timeout: 30_000 }),
    page.getByRole("button", { name: /^Sign in$/ }).click(),
  ]);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 30_000 }),
    page
      .getByRole("button", { name: /^Accept invitation$/ })
      .click(),
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
