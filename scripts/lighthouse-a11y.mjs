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
