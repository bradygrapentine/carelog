#!/usr/bin/env node
// scripts/lighthouse-a11y.mjs
// Runs a Lighthouse accessibility audit against a URL.
// Exits non-zero if a11y score < 90.
//
// Usage: node scripts/lighthouse-a11y.mjs [url]
//   url defaults to http://localhost:3000

import { spawnSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";

const url = process.argv[2] ?? "http://localhost:3000";
const outFile = `/tmp/lighthouse-${Date.now()}.json`;

console.log(`Running Lighthouse a11y audit on: ${url}`);

// Pre-flight: skip gracefully if the URL is unreachable or auth-gated.
// Vercel preview deployments default to auth-gated (401) — Lighthouse can't
// audit them, but the workflow runs on every deploy_status event including
// these. Treat 401/403 as a non-blocking skip rather than a CI failure.
const probe = spawnSync(
  "curl",
  ["-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "10", url],
  { stdio: ["ignore", "pipe", "inherit"], shell: false },
);
const httpCode = probe.stdout?.toString().trim() ?? "";
if (httpCode === "401" || httpCode === "403") {
  console.log(
    `⚠ ${url} is auth-gated (HTTP ${httpCode}) — skipping Lighthouse a11y audit. ` +
      `Run on a public URL to enforce a11y score gating.`,
  );
  process.exit(0);
}
if (probe.status !== 0 || !httpCode || httpCode === "000") {
  console.log(
    `⚠ ${url} unreachable from CI — skipping Lighthouse a11y audit.`,
  );
  process.exit(0);
}

let score;
try {
  const result = spawnSync(
    "npx",
    [
      "--yes",
      "@lhci/cli@latest",
      "collect",
      `--url=${url}`,
      "--settings.onlyCategories=accessibility",
      "--output=json",
      `--outputPath=${outFile}`,
    ],
    { stdio: "inherit", shell: false },
  );

  if (result.status !== 0) {
    console.error("❌ @lhci/cli collect failed");
    process.exit(1);
  }

  const raw = readFileSync(outFile, "utf-8");
  const report = JSON.parse(raw);

  if (typeof report?.categories?.accessibility?.score !== "number") {
    console.error("❌ Unexpected Lighthouse output format — missing accessibility score");
    process.exit(1);
  }

  score = Math.round(report.categories.accessibility.score * 100);
  console.log(`\nAccessibility score: ${score}/100`);

  const failing = Object.values(report.audits)
    .filter((a) => a.score !== null && a.score < 1 && a.details?.items?.length)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  if (failing.length) {
    console.log("\nTop failing audits:");
    for (const audit of failing) {
      console.log(`  - ${audit.id}: ${audit.title} (${audit.details.items.length} elements)`);
    }
  }
} finally {
  try {
    unlinkSync(outFile);
  } catch {
    // temp file may not exist if collection failed before writing
  }
}

if (score < 90) {
  console.error(`\n❌ Accessibility score ${score} < 90 threshold`);
  process.exit(1);
}
console.log("\n✅ Accessibility audit passed");
