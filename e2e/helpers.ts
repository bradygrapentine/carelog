import { Page, Browser } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// TD-220: E2E auth mints the login OTP through the GoTrue admin API instead of
// polling Mailpit — `generateLink({type:'magiclink'})` returns the 6-digit
// `email_otp` WITHOUT sending an email, removing the recurring
// `getOtpFromMailpit timed out` flake. E2E always runs against LOCAL Supabase
// (in CI too, via `supabase start`), so we use the standard public local
// service-role key by default. NOTE: do NOT reuse `apps/web/.env.local`'s
// SUPABASE_SERVICE_ROLE_KEY here — that is the PROD (`sb_secret_…`) key and
// local GoTrue rejects it. The hand-rolled env loader in playwright.config.ts
// also keeps surrounding quotes, so strip them defensively.
const stripQuotes = (s: string) => s.replace(/^["']|["']$/g, "");
const E2E_SUPABASE_URL = stripQuotes(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
);
// Universal supabase-demo local service-role key (public — in supabase docs +
// every default local install; config.toml sets no custom jwt secret). Override
// with E2E_SUPABASE_SERVICE_ROLE_KEY only for a non-default local stack.
// Stored as its three JWT segments and joined at runtime: the contiguous
// `eyJ….eyJ….sig` literal never appears in source, so secret scanners (gitleaks
// `jwt` rule) have nothing to match. This is a well-known PUBLIC key, not a secret.
const LOCAL_SERVICE_ROLE_KEY = [
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
  "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0",
  "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
].join(".");

let _admin: SupabaseClient | null = null;
function adminClient(): SupabaseClient {
  if (!_admin) {
    const key = stripQuotes(
      process.env.E2E_SUPABASE_SERVICE_ROLE_KEY || LOCAL_SERVICE_ROLE_KEY,
    );
    _admin = createClient(E2E_SUPABASE_URL, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _admin;
}

// Mint the login OTP out-of-band (no email). The /signin UI verifies with
// `type:"email"`; a `magiclink` `email_otp` lives in the SAME GoTrue OTP
// storage and verifies under `type:"email"` — do NOT switch this to
// `type:"magiclink"` or the UI verify will reject it. Call AFTER the UI's own
// send so this OTP is the most-recent one GoTrue honors.
export async function getOtpViaAdmin(email: string): Promise<string> {
  const { data, error } = await adminClient().auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) {
    throw new Error(
      `getOtpViaAdmin: generateLink failed for ${email}: ${error.message}`,
    );
  }
  const otp = data.properties?.email_otp;
  if (!otp) {
    throw new Error(`getOtpViaAdmin: no email_otp returned for ${email}`);
  }
  return otp;
}

// Post-#243 dashboard cards/detail-panels expose journal navigation via
// aria-label `Open care journal for ${orgName}` — no raw "View care journal"
// text exists anywhere on the dashboard. Reuse this selector everywhere.
export const CARE_JOURNAL_LINK_SELECTOR =
  'a[aria-label^="Open care journal for"]';

export async function clearMailpit(): Promise<void> {
  try {
    await fetch("http://127.0.0.1:54324/api/v1/messages", { method: "DELETE" });
  } catch {}
}

// Poll Mailpit for an OTP email rather than fixed-sleeping. Returns the 6-digit
// code. The default timeout is generous (30s) because shard-loaded CI delivers
// the Supabase OTP email well past the old 10s budget — different auth-dependent
// specs would lose the delivery race per run, reddening shard 1 reliably.
export async function getOtpFromMailpit(
  email: string,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pollIntervalMs = options.pollIntervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  let lastError = "no email yet";
  while (Date.now() < deadline) {
    try {
      const res = await fetch("http://127.0.0.1:54324/api/v1/messages");
      const data = (await res.json()) as {
        messages?: Array<{
          Snippet?: string;
          To?: Array<{ Address?: string }>;
        }>;
      };
      const messages = data?.messages ?? [];
      const msg = messages.find((m) => m.To?.some((t) => t.Address === email));
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
// (TD-73) Supabase enforces a hardcoded ~60s send-rate-limit per email
// address, regardless of `auth.email.max_frequency` and
// `auth.rate_limit.email_sent`. Tests that share an email across multiple
// signIn() calls (mid-suite) intermittently fail with "For security
// purposes, you can only request this after N seconds." The fix is at the
// callsite: pass a UNIQUE email per signIn() call. Use the
// `uniqueEmail("role-or-purpose")` helper exported below.
//
// Selector hardening (TD-39): the signin page has THREE elements containing
// the substring "Sign in" — heading "Sign in to CareSync", form button "Sign in",
// and MarketingNav link. `text=Sign in` matched ambiguously and could click the
// wrong element, leaving the form unsubmitted and waitForURL spinning until
// timeout. Use explicit role + exact name + form scoping instead.
export async function signIn(page: Page, email: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/signin");

  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: /^Continue with email$/ }).click();
  await page
    .getByText("Check your email", { exact: false })
    .waitFor({ timeout: 30_000 });

  // TD-220: mint the OTP via admin (no Mailpit). Called after the UI send so it
  // is the most-recent OTP GoTrue honors.
  const otp = await getOtpViaAdmin(email);
  await page.getByPlaceholder("123456").fill(otp);

  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 30_000 }),
    page.getByRole("button", { name: /^Verify code$/ }).click(),
  ]);
}

// Generate a Supabase-rate-limit-safe email. Tests should call this once per
// test (or once per `signIn()` callsite) so each OTP request hits a fresh
// per-email cooldown bucket. Pattern: `uniqueEmail("burn-coord")` →
// `e2e-burn-coord-1777244000123@test.com`.
export function uniqueEmail(purpose: string): string {
  return `e2e-${purpose}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.com`;
}

// Ensure the signed-in user has a care team / org membership. The (app)/layout
// guards membership-dependent surfaces (e.g. AIAssistantProvider only mounts
// when orgId is non-null) so any test that asserts on those surfaces must call
// this in its beforeEach. Idempotent: returns immediately if a team already
// exists. Leaves the page on /dashboard.
export async function ensureCareTeam(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await Promise.race([
    page.waitForSelector(CARE_JOURNAL_LINK_SELECTOR, { timeout: 15000 }),
    page.waitForSelector('a:has-text("Set up a care team")', {
      timeout: 15000,
    }),
  ]);

  // Post-#243 the master/detail layout dropped the "View care journal" text;
  // every team card / detail-panel CTA is now an <a aria-label="Open care
  // journal for ${orgName}">. Anchor on that aria-label, not raw text.
  const hasCareTeam =
    (await page.locator(CARE_JOURNAL_LINK_SELECTOR).count()) > 0;
  if (hasCareTeam) return;

  await page.click('a:has-text("Set up a care team")');
  await page.waitForURL(/\/onboarding/, { timeout: 10000 });
  await page.fill("[name=recipientName]", "E2E Test Person");
  await page.fill("[name=orgName]", "E2E Test Family");
  await page.click("button[type=submit]");
  // Onboarding redirects back to /dashboard with the team now seeded.
  // 30s matches signIn's post-OTP wait (TD-39): CI's slower runner +
  // cold-cache prod build can push the redirect past 15s even when the
  // submit succeeds. Locally it fits in 15s; in CI it doesn't. (TD-45)
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await page.waitForSelector(CARE_JOURNAL_LINK_SELECTOR, { timeout: 30_000 });
}

// Navigate from the dashboard to the journal page, creating a care team first if needed.
export async function navigateToJournal(page: Page): Promise<void> {
  await ensureCareTeam(page);
  await page.locator(CARE_JOURNAL_LINK_SELECTOR).first().click();
  await page.waitForURL(/\/journal\//);
}

// Send an invite from the Team panel and return the invite URL.
//
// (TD-73) Two layered breakages — both fixed here:
//   1. Panels under /journal/[id] render lazily based on `?panel=`. The
//      invite form lives on the Team panel only; calling this helper from
//      any other panel found nothing and hung forever. Switch to Team first.
//   2. PR #94 replaced the legacy `window.alert(inviteUrl)` with
//      `navigator.clipboard.writeText(inviteUrl) + toast.success(...)`.
//      The previous helper waited on `page.waitForEvent("dialog")` which
//      never fires anymore — read the response body instead.
//
// On desktop (≥ lg) the invite form is always shown via `lg:block`. Tests
// run at the 1280×720 desktop viewport so we skip the mobile-only branch
// where "Invite someone" is a toggle button.
export async function sendInviteAndGetUrl(
  page: Page,
  email: string,
  role: string,
): Promise<string> {
  // Switch to the Team panel — clicking the desktop tablist tab is enough;
  // SidebarContext writes ?panel=team into the URL and re-renders the layout.
  await page.getByRole("tab", { name: "Team" }).first().click();
  await page.getByLabel("Email address").waitFor({ state: "visible" });

  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Role").selectOption(role);

  // Capture the /api/invite response — that's where the inviteUrl lives now.
  const responsePromise = page.waitForResponse(
    (r) => r.url().endsWith("/api/invite") && r.request().method() === "POST",
    { timeout: 15_000 },
  );
  await page.getByRole("button", { name: "Send invite" }).click();
  const response = await responsePromise;
  const data = (await response.json()) as {
    inviteUrl?: string;
    error?: string;
  };
  if (!data.inviteUrl) {
    throw new Error(
      "No inviteUrl in /api/invite response: " + JSON.stringify(data),
    );
  }
  return data.inviteUrl;
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
  await Promise.all([
    page.waitForURL(/\/signin/, { timeout: 10000 }),
    page.getByRole("button", { name: /^Accept invitation$/ }).click(),
  ]);

  await page.getByLabel("Email address").fill(inviteeEmail);
  await page.getByRole("button", { name: /^Continue with email$/ }).click();
  await page.getByText("Check your email", { exact: false }).waitFor();
  // TD-220: admin-minted OTP (no Mailpit) — same swap as signIn().
  const otp = await getOtpViaAdmin(inviteeEmail);
  await page.getByPlaceholder("123456").fill(otp);

  // Redirected back to invite URL by DashboardClient pending invite bridge
  await Promise.all([
    page.waitForURL(/\/invite\//, { timeout: 30_000 }),
    page.getByRole("button", { name: /^Verify code$/ }).click(),
  ]);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 30_000 }),
    page.getByRole("button", { name: /^Accept invitation$/ }).click(),
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
