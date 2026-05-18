#!/usr/bin/env node
// scripts/check-e2e-string-drift.mjs
//
// TD-170d prevention: detect UX-04x-class regressions where a PR renames
// a UI string in apps/web/ without sweeping the matching e2e/ callsites.
//
// Algorithm: cross-file move-aware single pass. Build the global ADDED-strings
// set first (scoped to UI files only), then per-file REMOVED-strings, then
// filter movers, then search e2e/ with quote/word-boundary precision in Node
// (NOT shell grep — that risks command injection on rename diffs containing
// shell metacharacters and silently no-ops on missing e2e/).
//
// Usage:
//   node scripts/check-e2e-string-drift.mjs
//   GIT_DIFF_BASE=<sha> node scripts/check-e2e-string-drift.mjs  (retro-validation)
//
// Exit codes:
//   0 → no drift detected (or all flagged drifts have e2e:no-references opt-out)
//   1 → at least one drift detected; CI should fail

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

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
function isUiSourceFile(p) {
  if (!p.startsWith("apps/web/")) return false;
  if (p.includes("/__tests__/")) return false;
  return /\.(ts|tsx)$/.test(p);
}

function isCodeFile(p) {
  return /\.(ts|tsx|js|jsx|mjs)$/.test(p);
}

// Extract candidate user-facing strings from a single diff line.
export function extractStrings(line) {
  const out = new Set();
  const re = new RegExp(QUOTED.source, "g");
  let m;
  while ((m = re.exec(line)) !== null) out.add(m[1]);
  const jsx = line.match(JSX_TEXT);
  if (jsx) out.add(jsx[1].trim());
  return out;
}

// argv-based git invocation — no shell, no injection surface.
function git(args) {
  return execFileSync("git", args, { encoding: "utf-8", maxBuffer: 1024 * 1024 * 50 });
}

function listChangedUiFiles() {
  const raw = git(["diff", `${DIFF_BASE}...HEAD`, "--name-only"]).trim();
  if (!raw) return [];
  return raw.split("\n").filter(isUiSourceFile);
}

// Build global ADDED-strings set scoped to changed UI files only.
// (Whole-repo scope would let a lockfile / database.types.ts addition
//  containing the same literal silently mask a real removal.)
function buildAddedStringSet(uiFiles) {
  const added = new Set();
  if (uiFiles.length === 0) return added;
  const diff = git(["diff", `${DIFF_BASE}...HEAD`, "--", ...uiFiles]);
  for (const line of diff.split("\n")) {
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    for (const s of extractStrings(line)) added.add(s);
  }
  return added;
}

function buildRemovedPerFile(files) {
  const out = new Map();
  for (const file of files) {
    const diff = git(["diff", `${DIFF_BASE}...HEAD`, "--", file]);
    const removed = [];
    let lineNo = 0;
    for (const line of diff.split("\n")) {
      if (line.startsWith("@@")) {
        const m = line.match(/-(\d+)/);
        if (m) lineNo = parseInt(m[1], 10) - 1;
        continue;
      }
      if (line.startsWith("-")) {
        lineNo += 1;
        for (const s of extractStrings(line)) {
          removed.push({ string: s, line: lineNo });
        }
        continue;
      }
      if (line.startsWith("+")) continue;
      lineNo += 1;
    }
    if (removed.length > 0) out.set(file, removed);
  }
  return out;
}

// Allowlist: `// e2e:no-references "<exact-string>"` comments must live in
// code files (.ts/.tsx/.js/.jsx/.mjs) — disallowing .md/.yml prevents a
// stealth opt-out via an unrelated doc edit in the same PR.
function buildAllowlist() {
  const raw = git(["diff", `${DIFF_BASE}...HEAD`, "--name-only"]).trim();
  const codeFiles = raw ? raw.split("\n").filter(isCodeFile) : [];
  if (codeFiles.length === 0) return new Set();
  const diff = git(["diff", `${DIFF_BASE}...HEAD`, "--", ...codeFiles]);
  const allow = new Set();
  const re = /\/\/\s*e2e:no-references\s+"([^"]+)"/g;
  for (const line of diff.split("\n")) {
    if (line.startsWith("-") && !line.startsWith("---")) continue;
    let m;
    while ((m = re.exec(line)) !== null) allow.add(m[1]);
  }
  return allow;
}

function walkE2eFiles() {
  const root = "e2e";
  if (!existsSync(root)) return [];
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        stack.push(full);
      } else if (st.isFile() && /\.(ts|tsx|js|jsx|mjs)$/.test(name)) {
        out.push(full);
      }
    }
  }
  return out;
}

// In-process scan: for each removed string, find quoted occurrences in e2e/.
// Reads each e2e file once, scans all strings against it. No shell, no fork-per-string.
function findE2eReferences(strings, e2eFiles) {
  const result = new Map(); // string -> [{file, line, context}]
  if (strings.length === 0 || e2eFiles.length === 0) return result;
  const escaped = strings.map((s) => ({
    s,
    re: new RegExp(`["'\`]${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`]`),
  }));
  for (const file of e2eFiles) {
    let content;
    try {
      content = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { s, re } of escaped) {
        if (re.test(line)) {
          if (!result.has(s)) result.set(s, []);
          result.get(s).push({ file, line: i + 1, context: line.trim() });
        }
      }
    }
  }
  return result;
}

function main() {
  const changedUiFiles = listChangedUiFiles();
  if (changedUiFiles.length === 0) {
    console.log("No apps/web/ UI files changed in this PR — skipping E2E string-drift check.");
    process.exit(0);
  }

  const addedSet = buildAddedStringSet(changedUiFiles);
  const allowSet = buildAllowlist();
  const removedPerFile = buildRemovedPerFile(changedUiFiles);

  // Collect candidate removed strings (after move-detection + allowlist filter).
  const candidates = new Set();
  for (const removedList of removedPerFile.values()) {
    for (const { string } of removedList) {
      if (addedSet.has(string)) continue;
      if (allowSet.has(string)) continue;
      candidates.add(string);
    }
  }

  const e2eFiles = walkE2eFiles();
  if (e2eFiles.length === 0) {
    console.log("No e2e/ directory found — skipping E2E string-drift check.");
    process.exit(0);
  }
  const refMap = findE2eReferences([...candidates], e2eFiles);

  const findings = [];
  for (const [file, removedList] of removedPerFile.entries()) {
    for (const { string, line } of removedList) {
      const matches = refMap.get(string);
      if (matches && matches.length > 0) {
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
      `  2. Opt out per-string by adding to any code-file diff line: // e2e:no-references "<exact-string>"\n`,
  );
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
