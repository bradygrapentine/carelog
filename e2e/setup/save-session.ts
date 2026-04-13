// e2e/setup/save-session.ts
import { test } from "@playwright/test";
import path from "path";
import fs from "fs";

const SESSION_PATH = path.join(process.cwd(), ".playwright", "session.json");

test("save production session", async ({ page, context }) => {
  // Ensure output directory exists
  fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });

  await page.goto("https://care-log.org/signin");
  await page.waitForSelector('[placeholder="you@example.com"]');

  // Pause — manually enter email, receive OTP, sign in
  // The test will resume once you click the "Resume" button in the Playwright Inspector
  console.log(
    "\n🔑 Sign in at care-log.org in the browser window, then click Resume in the Playwright Inspector\n",
  );
  await page.pause();

  // Confirm we landed on dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  console.log("✅ Signed in successfully — saving session");

  // Save cookies + localStorage
  const state = await context.storageState();
  fs.writeFileSync(SESSION_PATH, JSON.stringify(state, null, 2));
  console.log("✅ Session saved to", SESSION_PATH);
});
