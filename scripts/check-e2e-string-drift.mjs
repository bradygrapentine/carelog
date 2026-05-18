#!/usr/bin/env node
// scripts/check-e2e-string-drift.mjs
//
// TD-170d prevention: detect UX-04x-class regressions where a PR renames
// a UI string in apps/web/ without sweeping the matching e2e/ callsites.
//
// Algorithm: cross-file move-aware single pass. Build the global ADDED-strings
// set first, then per-file REMOVED-strings, then filter movers, then grep e2e/
// with quote/word-boundary precision (NOT grep -F — that false-positives on
// substrings like "Sharepoint" matching "Share").
//
// Usage:
//   node scripts/check-e2e-string-drift.mjs
//   GIT_DIFF_BASE=<sha> node scripts/check-e2e-string-drift.mjs  (retro-validation)
//
// Exit codes:
//   0 → no drift detected (or all flagged drifts have e2e:no-references opt-out)
//   1 → at least one drift detected; CI should fail

import { execSync } from "node:child_process";

const DIFF_BASE = process.env.GIT_DIFF_BASE || "origin/main";

// User-facing string heuristic — leading capital, ≥5 chars, inside quotes,
// AND containing at least one lowercase letter (rejects all-caps constants
// like "PENDING" / "STATUS_OK" that aren't user-facing copy).
const QUOTED = /(?:^|[^A-Za-z0-9_])["']([A-Z](?=[^"'\\]*[a-z])[^"'\\]{4,})["']/g;
// JSX text node — leading capital, ≥5 chars, alone on a diff line.
// Allows `&` and `;` for HTML entities like `&apos;` / `&amp;` that frequently
// appear in JSX-escaped text (UX-049's "You&apos;re helping out" case).
const JSX_TEXT = /^[+-]\s+([A-Z](?=[^]*[a-z])[a-zA-Z0-9 ,.!?'"\-&;]{4,})\s*$/;

// File filter — UI surface only (NOT __tests__/):
function isUiSourceFile(path) {
  if (!path.startsWith("apps/web/")) return false;
  if (path.includes("/__tests__/")) return false;
  return /\.(ts|tsx)$/.test(path);
}

// Extract candidate user-facing strings from a single diff line.
export function extractStrings(line) {
  const out = new Set();
  // QUOTED pattern (use a fresh RegExp instance per line; global flag mutates state)
  const re = new RegExp(QUOTED.source, "g");
  let m;
  while ((m = re.exec(line)) !== null) out.add(m[1]);
  // JSX_TEXT pattern (per-line)
  const jsx = line.match(JSX_TEXT);
  if (jsx) out.add(jsx[1].trim());
  return out;
}

function git(args) {
  return execSync(`git ${args}`, { encoding: "utf-8", maxBuffer: 1024 * 1024 * 50 });
}

// Step 2: list of UI files in the diff.
function listChangedUiFiles() {
  const raw = git(`diff ${DIFF_BASE}...HEAD --name-only`).trim();
  if (!raw) return [];
  return raw.split("\n").filter(isUiSourceFile);
}

// Step 3: build global ADDED-strings set from the entire PR diff.
function buildAddedStringSet() {
  const diff = git(`diff ${DIFF_BASE}...HEAD`);
  const added = new Set();
  for (const line of diff.split("\n")) {
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    for (const s of extractStrings(line)) added.add(s);
  }
  return added;
}

// Step 4: build per-file REMOVED-strings map.
function buildRemovedPerFile(files) {
  const out = new Map();
  for (const file of files) {
    const diff = git(`diff ${DIFF_BASE}...HEAD -- "${file}"`);
    const removed = [];
    let lineNo = 0;
    for (const line of diff.split("\n")) {
      if (line.startsWith("@@")) {
        // Parse "@@ -A,B +C,D @@" — track removed-side line number
        const m = line.match(/-(\d+)/);
        if (m) lineNo = parseInt(m[1], 10) - 1;
        continue;
      }
      if (line.startsWith("---")) continue;
      if (line.startsWith("-")) {
        lineNo += 1;
        for (const s of extractStrings(line)) {
          removed.push({ string: s, line: lineNo });
        }
        continue;
      }
      if (line.startsWith("+")) continue; // doesn't advance removed-side counter
      // context line — advances removed-side counter
      lineNo += 1;
    }
    if (removed.length > 0) out.set(file, removed);
  }
  return out;
}

// Allowlist: scan the PR's full diff for `// e2e:no-references "<exact-string>"` comments.
// Per-PR scope; comment can live in any file in the diff.
function buildAllowlist() {
  const diff = git(`diff ${DIFF_BASE}...HEAD`);
  const allow = new Set();
  const re = /\/\/\s*e2e:no-references\s+"([^"]+)"/g;
  for (const line of diff.split("\n")) {
    // Only consider added lines (PR author actively opting out) or context
    if (line.startsWith("-") && !line.startsWith("---")) continue;
    let m;
    while ((m = re.exec(line)) !== null) allow.add(m[1]);
  }
  return allow;
}

// Step 6: grep e2e/ with quote/word-boundary precision. Returns matches per string.
function grepE2eForString(s) {
  // Escape regex special chars in the string literal for grep -E:
  const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match: opening quote (" or ' or backtick) + escaped string + closing quote
  // Use Node-side filtering since grep -E quoting can choke on apostrophes etc.
  let out;
  try {
    out = execSync(`grep -rEn "(\\"|')${escaped}(\\"|')" e2e/ || true`, {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 10,
    });
  } catch {
    return [];
  }
  return out
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^([^:]+):(\d+):(.+)$/);
      return m ? { file: m[1], line: parseInt(m[2], 10), context: m[3].trim() } : null;
    })
    .filter(Boolean);
}

function main() {
  const changedUiFiles = listChangedUiFiles();
  if (changedUiFiles.length === 0) {
    console.log("No apps/web/ UI files changed in this PR — skipping E2E string-drift check.");
    process.exit(0);
  }

  const addedSet = buildAddedStringSet();
  const allowSet = buildAllowlist();
  const removedPerFile = buildRemovedPerFile(changedUiFiles);

  const findings = [];
  for (const [file, removedList] of removedPerFile.entries()) {
    for (const { string, line } of removedList) {
      if (addedSet.has(string)) continue; // move detection: skip refactors
      if (allowSet.has(string)) continue; // PR-author opt-out
      const matches = grepE2eForString(string);
      if (matches.length > 0) {
        findings.push({ file, line, string, matches });
      }
    }
  }

  if (findings.length === 0) {
    console.log(`✅ No E2E string drift detected across ${changedUiFiles.length} changed UI file(s).`);
    process.exit(0);
  }

  console.error(`❌ E2E string drift detected — ${findings.length} string(s):`);
  for (const f of findings) {
    console.error(`\n  ${f.file}:${f.line}  removed: "${f.string}"`);
    for (const m of f.matches) {
      console.error(`    referenced in ${m.file}:${m.line}  →  ${m.context}`);
    }
  }
  console.error(
    "\nFix options:\n" +
      "  1. Update the e2e callsites to match the new string.\n" +
      `  2. Opt out per-string by adding to any diff line: // e2e:no-references "<exact-string>"\n`,
  );
  process.exit(1);
}

// Only run main when invoked directly (not when imported by tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
