#!/usr/bin/env node
// scripts/lighthouse-a11y.mjs
// Runs Lighthouse accessibility audits against one or more URLs.
// Exits non-zero if ANY audited URL scores below 90.
//
// Usage: node scripts/lighthouse-a11y.mjs [url ...]
//   url(s) default to http://localhost:3000

import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LHCI_VERSION = "0.15.1";
const SCORE_THRESHOLD = 90;
const DEFAULT_URLS = ["http://localhost:3000"];

const rawArgs = process.argv.slice(2);
const urls = rawArgs.length > 0 ? rawArgs : DEFAULT_URLS;

// TD-184 (items 1+2): split the original `auditOne` into `probeUrl` (curl reachability)
// and `runLhci` (lhci collect + report parse). Each function owns a single failure
// mode so the composing `auditOne` reads as a 3-step pipeline.

function probeUrl(url) {
  const result = spawnSync(
    "curl",
    ["-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "10", url],
    { stdio: ["ignore", "pipe", "inherit"], shell: false },
  );
  const httpCode = result.stdout?.toString().trim() ?? "";
  if (httpCode === "200") return { ok: true, httpCode };
  const inCI = process.env.CI === "true";
  const reason = `${url} returned HTTP ${httpCode || "unreachable"}`;
  return { ok: false, httpCode, inCI, reason };
}

function runLhci(url) {
  // @lhci/cli collect writes to .lighthouseci/lhr-<unix-ms>.json relative to cwd
  // (NOT to a path you pass via --outputPath — that flag is for `lhci upload`).
  // Use a per-URL tempdir so each audit's reports stay isolated and the
  // readdir below can pick the single output deterministically.
  const workDir = mkdtempSync(join(tmpdir(), "lh-"));
  try {
    const result = spawnSync(
      "npx",
      [
        "--yes",
        `@lhci/cli@${LHCI_VERSION}`,
        "collect",
        `--url=${url}`,
        "--numberOfRuns=1",
        "--settings.onlyCategories=accessibility",
      ],
      { stdio: "inherit", shell: false, cwd: workDir },
    );
    if (result.status !== 0) {
      return { ok: false, reason: "@lhci/cli collect failed" };
    }
    const lhciDir = join(workDir, ".lighthouseci");
    const reports = readdirSync(lhciDir).filter(
      (f) => f.startsWith("lhr-") && f.endsWith(".json"),
    );
    if (reports.length === 0) {
      return { ok: false, reason: "no lhr-*.json in .lighthouseci/" };
    }
    const report = JSON.parse(readFileSync(join(lhciDir, reports[0]), "utf-8"));
    const raw = report?.categories?.accessibility?.score;
    if (typeof raw !== "number") {
      return { ok: false, reason: "missing accessibility score" };
    }
    const score = Math.round(raw * 100);
    const failingAudits = Object.values(report.audits)
      .filter((a) => a.score !== null && a.score < 1 && a.details?.items?.length)
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
      .map((a) => ({ id: a.id, title: a.title, elements: a.details.items.length }));
    return { ok: true, score, failingAudits };
  } finally {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      // tempdir may already be cleaned up
    }
  }
}

function auditOne(url) {
  const probe = probeUrl(url);
  if (!probe.ok) {
    if (probe.inCI) {
      console.error(`❌ ${probe.reason} — failing CI run`);
      return { url, score: 0, failed: true, audits: [], reason: probe.reason };
    }
    console.log(`⚠ ${probe.reason} — skipping (CI=false)`);
    return { url, score: null, failed: false, audits: [], reason: probe.reason };
  }
  const lhci = runLhci(url);
  if (!lhci.ok) {
    return { url, score: 0, failed: true, audits: [], reason: lhci.reason };
  }
  return {
    url,
    score: lhci.score,
    failed: lhci.score < SCORE_THRESHOLD,
    audits: lhci.failingAudits,
    reason: lhci.score < SCORE_THRESHOLD ? `score ${lhci.score} < ${SCORE_THRESHOLD}` : null,
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
