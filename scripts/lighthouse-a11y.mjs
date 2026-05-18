#!/usr/bin/env node
// scripts/lighthouse-a11y.mjs
// Runs Lighthouse accessibility audits against one or more URLs.
// Exits non-zero if ANY audited URL scores below 90.
//
// Usage: node scripts/lighthouse-a11y.mjs [url ...]
//   url(s) default to http://localhost:3000

import { spawnSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";

const LHCI_VERSION = "0.15.1";
const SCORE_THRESHOLD = 90;
const DEFAULT_URLS = ["http://localhost:3000"];

const urls = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_URLS;

function probe(url) {
  const result = spawnSync(
    "curl",
    ["-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "10", url],
    { stdio: ["ignore", "pipe", "inherit"], shell: false },
  );
  return result.stdout?.toString().trim() ?? "";
}

function auditOne(url) {
  const httpCode = probe(url);
  if (httpCode !== "200") {
    const inCI = process.env.CI === "true";
    const msg = `${url} returned HTTP ${httpCode || "unreachable"}`;
    if (inCI) {
      console.error(`❌ ${msg} — failing CI run`);
      return { url, score: 0, failed: true, audits: [], reason: msg };
    }
    console.log(`⚠ ${msg} — skipping (CI=false)`);
    return { url, score: null, failed: false, audits: [], reason: msg };
  }

  const outFile = `/tmp/lighthouse-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
  let score = null;
  let failingAudits = [];
  try {
    const result = spawnSync(
      "npx",
      [
        "--yes",
        `@lhci/cli@${LHCI_VERSION}`,
        "collect",
        `--url=${url}`,
        "--settings.onlyCategories=accessibility",
        "--output=json",
        `--outputPath=${outFile}`,
      ],
      { stdio: "inherit", shell: false },
    );
    if (result.status !== 0) {
      return { url, score: 0, failed: true, audits: [], reason: "@lhci/cli collect failed" };
    }
    const report = JSON.parse(readFileSync(outFile, "utf-8"));
    const raw = report?.categories?.accessibility?.score;
    if (typeof raw !== "number") {
      return { url, score: 0, failed: true, audits: [], reason: "missing accessibility score" };
    }
    score = Math.round(raw * 100);
    failingAudits = Object.values(report.audits)
      .filter((a) => a.score !== null && a.score < 1 && a.details?.items?.length)
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
      .map((a) => ({ id: a.id, title: a.title, elements: a.details.items.length }));
  } finally {
    try {
      unlinkSync(outFile);
    } catch {
      // temp file may not exist if collection failed before writing
    }
  }

  return {
    url,
    score,
    failed: score < SCORE_THRESHOLD,
    audits: failingAudits,
    reason: score < SCORE_THRESHOLD ? `score ${score} < ${SCORE_THRESHOLD}` : null,
  };
}

console.log(`Lighthouse a11y audit — ${urls.length} URL(s), threshold ${SCORE_THRESHOLD}/100`);

const results = urls.map((url) => {
  console.log(`\n→ Auditing ${url}`);
  return auditOne(url);
});

console.log("\n=== Results ===");
for (const r of results) {
  const status = r.failed ? "❌" : r.score === null ? "⚠ " : "✅";
  const scoreStr = r.score === null ? "(skipped)" : `${r.score}/100`;
  console.log(`${status}  ${scoreStr}  ${r.url}${r.reason ? `  — ${r.reason}` : ""}`);
  for (const audit of r.audits) {
    console.log(`     · ${audit.id}: ${audit.title} (${audit.elements} elements)`);
  }
}

const anyFailed = results.some((r) => r.failed);
if (anyFailed) {
  const failedCount = results.filter((r) => r.failed).length;
  console.error(`\n❌ ${failedCount}/${results.length} URL(s) failed Lighthouse a11y threshold`);
  process.exit(1);
}
console.log("\n✅ All audited URLs passed");
