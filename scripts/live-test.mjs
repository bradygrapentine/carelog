#!/usr/bin/env node
// scripts/live-test.mjs — rapid UI-iteration loop driver for /live-test.
//
// Three modes built on Playwright + persistent storage state:
//
//   record  <flow>           Walk a flow once. Saves storage-state + flow JSON.
//   replay  <flow>           Replay against same browser session. Reuses signed-in cookies.
//                            Captures screenshots + a11y snapshots per step.
//   watch   <flow> [paths]   Replay on every file change in <paths> (default: apps/web/**).
//
// State layout (gitignored):
//   .live-test/flows/<flow>.json          Recorded steps
//   .live-test/state/<flow>.json          Playwright storageState
//   .live-test/runs/<unix-ts>/<step>.png  Screenshot per step
//   .live-test/runs/<unix-ts>/<step>.snap.json  A11y snapshot per step
//   .live-test/runs/<unix-ts>/report.md   Run report w/ image links
//
// Flow JSON shape:
//   {
//     "name": "post-journal-entry",
//     "baseUrl": "http://localhost:3000",
//     "email": "live-test@example.com",   // for ensureSignedIn
//     "steps": [
//       { "kind": "ensureSignedIn" },
//       { "kind": "ensureCareTeam", "recipientName": "TD55 Person", "orgName": "TD55 Family" },
//       { "kind": "navigate", "url": "/journal/${recipientId}" },
//       { "kind": "clickRole", "role": "tab", "name": "More" },
//       { "kind": "expect", "text": "Symptom readings" }
//     ]
//   }
//
// Quick start: cp .live-test/flows.example/post-journal.json .live-test/flows/post-journal.json
//              node scripts/live-test.mjs record post-journal
//              node scripts/live-test.mjs watch  post-journal apps/web/app

import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync, watch } from "node:fs";
import { join, dirname, resolve } from "node:path";

const ROOT = resolve(process.cwd().includes(".worktrees")
  ? process.cwd().split(".worktrees")[0]
  : process.cwd());
const STATE_DIR = join(ROOT, ".live-test");
const FLOWS_DIR = join(STATE_DIR, "flows");
const SESSIONS_DIR = join(STATE_DIR, "state");
const RUNS_DIR = join(STATE_DIR, "runs");

// ─── helpers ──────────────────────────────────────────────────────────────

const ensureDirs = () => [STATE_DIR, FLOWS_DIR, SESSIONS_DIR, RUNS_DIR].forEach(d => mkdirSync(d, { recursive: true }));

const flowPath = name => join(FLOWS_DIR, `${name}.json`);
const statePath = name => join(SESSIONS_DIR, `${name}.json`);
const runDir = ts => join(RUNS_DIR, String(ts));

const readFlow = name => {
  const p = flowPath(name);
  if (!existsSync(p)) throw new Error(`No flow at ${p}. Create one or run \`record ${name}\`.`);
  return JSON.parse(readFileSync(p, "utf-8"));
};

async function getOtp(email, deadlineMs = 12000) {
  const end = Date.now() + deadlineMs;
  while (Date.now() < end) {
    try {
      const r = await fetch("http://127.0.0.1:54324/api/v1/messages");
      const d = await r.json();
      const msg = (d.messages || []).find(m => (m.To || []).some(t => t.Address === email));
      if (msg) {
        const r2 = await fetch(`http://127.0.0.1:54324/api/v1/message/${msg.ID}`);
        const body = await r2.json();
        const t = (body.Text || "") + " " + (msg.Snippet || "");
        const m = t.match(/\b(\d{6})\b/);
        if (m) return m[1];
      }
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`OTP timeout for ${email}`);
}

async function preflight() {
  // Docker
  try { execSync("docker info > /dev/null 2>&1"); } catch { throw new Error("Docker not running."); }
  // Supabase
  try { execSync("curl -sf http://127.0.0.1:54321/rest/v1/ > /dev/null 2>&1"); } catch { throw new Error("Supabase not running. Run `supabase start`."); }
  // Dev server
  try { execSync("curl -sf http://localhost:3000 > /dev/null 2>&1"); } catch { throw new Error("Next.js dev server not on :3000. Run `pnpm web`."); }
}

// ─── step executor ────────────────────────────────────────────────────────

async function runSignIn(page, email) {
  await page.goto(page.context()._options?.baseURL ? "/signin" : "http://localhost:3000/signin");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: /^Continue with email$/ }).click();
  await page.getByText("Check your email", { exact: false }).waitFor({ timeout: 10000 });
  const otp = await getOtp(email);
  await page.getByLabel("Enter your code").fill(otp);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 20000 });
}

async function ensureSignedIn(page, email) {
  // Try navigating to /dashboard. If we end up at /signin, we need to sign in.
  await page.goto("http://localhost:3000/dashboard");
  await page.waitForLoadState("domcontentloaded");
  if (page.url().includes("/signin")) {
    console.log(`  ↻ session expired/missing — signing in as ${email}`);
    await runSignIn(page, email);
  } else {
    console.log(`  ✓ session valid (skipped signin)`);
  }
}

async function ensureCareTeam(page, recipientName, orgName) {
  await page.goto("http://localhost:3000/dashboard");
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  const hasTeam = (await page.locator(`text="${orgName}"`).count()) > 0;
  if (hasTeam) { console.log(`  ✓ care team "${orgName}" exists`); return; }
  await page.goto("http://localhost:3000/onboarding");
  await page.fill("[name=recipientName]", recipientName);
  await page.fill("[name=orgName]", orgName);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
}

async function executeStep(page, step, ctx, runDirPath, idx) {
  const label = `${String(idx).padStart(2, "0")}-${step.kind}${step.name ? `-${step.name}` : ""}`.replace(/[^\w-]/g, "_");
  const result = { idx, kind: step.kind, label, ok: true, ms: 0, error: null };
  const t0 = Date.now();

  try {
    switch (step.kind) {
      case "ensureSignedIn":
        await ensureSignedIn(page, ctx.email);
        break;
      case "ensureCareTeam":
        await ensureCareTeam(page, step.recipientName, step.orgName);
        break;
      case "navigate":
        await page.goto(step.url.replace("${recipientId}", ctx.recipientId || ""));
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
        break;
      case "clickRole":
        await page.getByRole(step.role, { name: step.name }).click();
        break;
      case "clickText":
        await page.click(`text="${step.text}"`);
        break;
      case "fill":
        await page.fill(step.selector, step.value);
        break;
      case "expect":
        await page.locator(`text="${step.text}"`).waitFor({ timeout: step.timeout || 8000 });
        break;
      case "wait":
        await page.waitForTimeout(step.ms || 500);
        break;
      case "screenshot":
        // explicit; otherwise screenshots are auto-taken after every step below
        break;
      default:
        throw new Error(`Unknown step kind: ${step.kind}`);
    }
  } catch (e) {
    result.ok = false;
    result.error = e.message;
  }
  result.ms = Date.now() - t0;

  // ALWAYS capture screenshot + a11y snapshot after every step for multimodal feedback.
  try {
    await page.screenshot({ path: join(runDirPath, `${label}.png`), fullPage: true });
    const snap = await page.accessibility.snapshot({ interestingOnly: false });
    writeFileSync(join(runDirPath, `${label}.snap.json`), JSON.stringify(snap, null, 2));
  } catch (e) {
    result.error = (result.error || "") + ` [snapshot failed: ${e.message}]`;
  }

  console.log(`  ${result.ok ? "✓" : "✗"} ${label} (${result.ms}ms)${result.error ? " — " + result.error : ""}`);
  return result;
}

// ─── modes ────────────────────────────────────────────────────────────────

async function run(flowName, { useStoredState, screenshot = true } = {}) {
  await preflight();
  ensureDirs();
  const flow = readFlow(flowName);
  const ts = Math.floor(Date.now() / 1000);
  const rdir = runDir(ts);
  mkdirSync(rdir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctxOpts = {};
  if (useStoredState && existsSync(statePath(flowName))) {
    ctxOpts.storageState = statePath(flowName);
    console.log(`Using stored state: ${statePath(flowName)}`);
  }
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();

  const consoleErrs = [];
  const fails = [];
  page.on("console", m => { if (m.type() === "error") consoleErrs.push(m.text()); });
  page.on("response", r => { if (r.status() >= 400) fails.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 200)}`); });

  const flowCtx = { email: flow.email, recipientId: null };
  const results = [];
  console.log(`\n=== Replay: ${flowName} (run ${ts}) ===`);
  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i];
    const r = await executeStep(page, step, flowCtx, rdir, i);
    results.push(r);
    // Capture recipientId if we just navigated to /journal/<id>
    const m = page.url().match(/\/journal\/([^/?]+)/);
    if (m) flowCtx.recipientId = m[1];
    if (!r.ok) break; // stop on first failure for clarity
  }

  // Save fresh storage state for next replay (only if signin happened)
  await ctx.storageState({ path: statePath(flowName) });

  await browser.close();

  // Report
  const reportPath = join(rdir, "report.md");
  const md = [
    `# /live-test replay — ${flowName} — ${new Date().toISOString()}`,
    "",
    `| # | Step | Result | Time | Screenshot |`,
    `|---|---|---|---|---|`,
    ...results.map(r => `| ${r.idx} | ${r.kind}${r.error ? " ⚠" : ""} | ${r.ok ? "✓" : "✗"} | ${r.ms}ms | ![](${r.label}.png) |`),
    "",
    `## Console errors (${consoleErrs.length})`,
    consoleErrs.length ? consoleErrs.slice(0, 20).map(e => "- " + e).join("\n") : "_(none)_",
    "",
    `## Network 4xx/5xx (${fails.length})`,
    fails.length ? fails.slice(0, 20).map(f => "- " + f).join("\n") : "_(none)_",
    "",
    `## Files`,
    `- Screenshots: \`${rdir}/*.png\``,
    `- A11y snapshots: \`${rdir}/*.snap.json\``,
    `- Storage state: \`${statePath(flowName)}\``,
  ].join("\n");
  writeFileSync(reportPath, md);
  console.log(`\nReport: ${reportPath}`);
  console.log(`Screenshots: ${rdir}/`);

  return { ts, results, reportPath, ok: results.every(r => r.ok) };
}

async function watchMode(flowName, paths) {
  const watchPaths = paths.length ? paths : ["apps/web/app", "apps/web/components", "apps/web/hooks"];
  console.log(`Watching: ${watchPaths.join(", ")}`);

  await run(flowName, { useStoredState: true });

  let pending = false;
  let inFlight = false;
  const trigger = () => {
    if (inFlight) { pending = true; return; }
    inFlight = true;
    setTimeout(async () => {
      try {
        await run(flowName, { useStoredState: true });
      } catch (e) { console.error("Replay failed:", e.message); }
      inFlight = false;
      if (pending) { pending = false; trigger(); }
    }, 500); // debounce
  };

  for (const p of watchPaths) {
    const fp = join(ROOT, p);
    if (existsSync(fp)) {
      watch(fp, { recursive: true }, (evt, file) => {
        if (file && /\.(tsx?|jsx?|css)$/.test(file)) {
          console.log(`\n→ change: ${p}/${file}`);
          trigger();
        }
      });
    }
  }
  console.log("\nWaiting for file changes... Ctrl-C to stop.");
}

// ─── CLI ──────────────────────────────────────────────────────────────────

const [mode, flowName, ...rest] = process.argv.slice(2);
if (!mode || !flowName) {
  console.error("Usage: node scripts/live-test.mjs <record|replay|watch> <flow-name> [paths...]");
  process.exit(1);
}

(async () => {
  try {
    if (mode === "record" || mode === "replay") {
      await run(flowName, { useStoredState: mode === "replay" });
    } else if (mode === "watch") {
      await watchMode(flowName, rest);
    } else {
      console.error(`Unknown mode: ${mode}`);
      process.exit(1);
    }
  } catch (e) {
    console.error("ERROR:", e.message);
    process.exit(1);
  }
})();
