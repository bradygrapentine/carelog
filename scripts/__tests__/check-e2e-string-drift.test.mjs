// scripts/__tests__/check-e2e-string-drift.test.mjs
// node:test unit suite for TD-170d E2E string-drift detector.
// Run: node --test scripts/__tests__/check-e2e-string-drift.test.mjs

import { test } from "node:test";
import { strict as assert } from "node:assert";

import { extractStrings } from "../check-e2e-string-drift.mjs";

// Helper: assert candidate set contains exactly the expected user-facing strings.
function assertExtracted(line, expected) {
  const got = extractStrings(line);
  const gotArr = Array.from(got).sort();
  const wantArr = [...expected].sort();
  assert.deepEqual(gotArr, wantArr, `from "${line}"`);
}

test("catches PR #529 'Share update' button rename", () => {
  // Removed line from JournalEntryForm.tsx (real diff):
  assertExtracted(`-                  {posting ? "Sharing..." : "Share update"}`, [
    "Sharing...",
    "Share update",
  ]);
  // "Share update" is the load-bearing case for TD-170c. "Sharing..." also extracted
  // (≥5 chars + leading cap + lowercase body). Either catches the drift.
});

test("catches PR #528 'Thanks! You're helping out.' JSX text node (HTML entity preserved)", () => {
  assertExtracted(`-            Thanks! You&apos;re helping out.`, ["Thanks! You&apos;re helping out."]);
  // `&apos;` HTML entity preserved via JSX_TEXT regex's `&;` allowance.
});

test("catches PR #525 'No billing history yet.' JSX text node", () => {
  assertExtracted(`-            No billing history yet.`, ["No billing history yet."]);
});

test("ignores ≤4 char strings (filters identifiers + small constants)", () => {
  assertExtracted(`-  const x = "Foo";`, []); // "Foo" is 3 chars, rejected
  assertExtracted(`-  const x = "Ab";`, []); // "Ab" is 2 chars, rejected
});

test("ignores all-caps constants (enum names)", () => {
  assertExtracted(`-  const KIND = "PENDING";`, []); // "PENDING" — all-caps, rejected by trailing class requiring lowercase
});

test("ignores lowercase-leading strings (typically identifiers, not user-facing)", () => {
  assertExtracted(`-  const slug = "foo bar baz";`, []); // leading lowercase rejected
});

test("extracts multiple strings from one line", () => {
  assertExtracted(
    `-  return { title: "Order summary", subtitle: "Review your cart" };`,
    ["Order summary", "Review your cart"],
  );
});

test("handles single-quoted strings", () => {
  assertExtracted(`-  const msg = 'Welcome back to your dashboard';`, ["Welcome back to your dashboard"]);
});

test("does not extract from code identifiers (no surrounding quotes)", () => {
  assertExtracted(`-  function ShareUpdate() {}`, []);
  assertExtracted(`-  import { Sharing } from "./foo";`, []); // "./foo" is too short anyway
});

test("JSX_TEXT requires leading capital and ≥5 chars", () => {
  assertExtracted(`-            click here`, []); // lowercase rejected
  assertExtracted(`-            Hi`, []); // too short
  assertExtracted(`-            Hello`, ["Hello"]); // exactly 5 chars, capitalized ✓
});

test("does not over-match on substring patterns (word-boundary discipline)", () => {
  // The QUOTED regex requires the string to be inside quotes, not just appear as substring.
  // "Shareable" alone (no quotes around target part) should NOT extract "Sharea":
  assertExtracted(`-  const text = "This product is shareable across teams";`, [
    "This product is shareable across teams",
  ]);
  // Only the WHOLE quoted string is the candidate. The grep step against e2e/ is what
  // protects against substring false-matches — it requires the e2e literal to be inside
  // quotes too. Tested at integration level (Acceptance #6 retro-validation).
});

test("known limitation: strings with embedded apostrophe-in-double-quotes don't extract", () => {
  // QUOTED regex body uses [^"'\\] which rejects ANY apostrophe — so "Don't worry"
  // gets cut at the apostrophe and never reaches the closing ". This is a known
  // limitation. JSX text content with apostrophes-as-entities IS extracted via
  // JSX_TEXT (see Thanks! test above). The mitigation is that source-code apostrophes
  // in quoted strings are rare in user-facing copy (apps tend to use HTML entities
  // or template literals).
  assertExtracted(`-  const msg = "Don't worry";`, []);
});

test("rejects strings that start with lowercase even if long", () => {
  assertExtracted(`-  const help = "click here to continue your work";`, []);
});

test("JSX_TEXT does not match lines with surrounding code (must be text-only)", () => {
  // JSX_TEXT regex requires the line to be ONLY the text (no other tokens).
  // A line with code + text shouldn't fire JSX_TEXT.
  const got = extractStrings('-  return <p>Hello world {name}</p>;');
  // No QUOTED match (no leading-cap quoted user string); JSX_TEXT rejects because line has code.
  assert.equal(got.size, 0);
});
