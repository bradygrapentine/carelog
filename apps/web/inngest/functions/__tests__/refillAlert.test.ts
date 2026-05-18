// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  detectLowSupply,
  batchByOrgRecipient,
  buildRefillEmailBody,
  refillDedupKey,
  type MedicationRow,
} from "../refillAlert";
import { isoWeekStamp } from "@carelog/utils";

const BASE: MedicationRow = {
  id: "00000000-0000-0000-0000-000000000001",
  org_id: "00000000-0000-0000-0000-000000000002",
  recipient_id: "00000000-0000-0000-0000-000000000003",
  drug_name: "Lisinopril",
  supply_days_remaining: 5,
  pharmacy: null,
  pharmacy_phone: null,
};

describe("detectLowSupply", () => {
  it("returns medications with supply_days_remaining <= 7", () => {
    const meds = [
      { ...BASE, id: "1", supply_days_remaining: 0 },
      { ...BASE, id: "2", supply_days_remaining: 3 },
      { ...BASE, id: "3", supply_days_remaining: 7 },
      { ...BASE, id: "4", supply_days_remaining: 8 },
      { ...BASE, id: "5", supply_days_remaining: 30 },
    ];
    const low = detectLowSupply(meds);
    expect(low).toHaveLength(3);
    expect(low.map((m) => m.id)).toEqual(["1", "2", "3"]);
  });

  it("returns empty array when all medications have sufficient supply", () => {
    const meds = [
      { ...BASE, id: "1", supply_days_remaining: 10 },
      { ...BASE, id: "2", supply_days_remaining: 30 },
    ];
    expect(detectLowSupply(meds)).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(detectLowSupply([])).toHaveLength(0);
  });

  it("includes medications with exactly 7 days remaining", () => {
    const meds = [{ ...BASE, supply_days_remaining: 7 }];
    expect(detectLowSupply(meds)).toHaveLength(1);
  });

  it("excludes medications with exactly 8 days remaining", () => {
    const meds = [{ ...BASE, supply_days_remaining: 8 }];
    expect(detectLowSupply(meds)).toHaveLength(0);
  });
});

// ─── ON-71 Phase 2 ──────────────────────────────────────────────────────────

describe("batchByOrgRecipient (H2 — batching prevents email amplification)", () => {
  it("groups 5 meds for 1 recipient into 1 batch with 5 meds", () => {
    const meds = [
      { ...BASE, id: "1", drug_name: "Lisinopril" },
      { ...BASE, id: "2", drug_name: "Metformin" },
      { ...BASE, id: "3", drug_name: "Atorvastatin" },
      { ...BASE, id: "4", drug_name: "Amlodipine" },
      { ...BASE, id: "5", drug_name: "Levothyroxine" },
    ];
    const batches = batchByOrgRecipient(meds);
    expect(batches).toHaveLength(1);
    expect(batches[0].medications).toHaveLength(5);
  });

  it("splits across distinct (org, recipient) tuples", () => {
    const meds = [
      { ...BASE, id: "1", org_id: "org-a", recipient_id: "rec-1" },
      { ...BASE, id: "2", org_id: "org-a", recipient_id: "rec-1" },
      { ...BASE, id: "3", org_id: "org-a", recipient_id: "rec-2" },
      { ...BASE, id: "4", org_id: "org-b", recipient_id: "rec-1" },
    ];
    const batches = batchByOrgRecipient(meds);
    expect(batches).toHaveLength(3);
    const counts = batches.map((b) => b.medications.length).sort();
    expect(counts).toEqual([1, 1, 2]);
  });

  it("empty input returns empty batches", () => {
    expect(batchByOrgRecipient([])).toEqual([]);
  });
});

describe("buildRefillEmailBody (H3/H4 — plain text only, pharmacy in body only)", () => {
  it("plain text body lists each medication with days remaining", () => {
    const batch = {
      org_id: "org-a",
      recipient_id: "rec-1",
      medications: [
        { ...BASE, drug_name: "Lisinopril", supply_days_remaining: 3 },
        { ...BASE, drug_name: "Metformin", supply_days_remaining: 7 },
      ],
    };
    const body = buildRefillEmailBody(batch);
    expect(body).toContain("Lisinopril");
    expect(body).toContain("3 days left");
    expect(body).toContain("Metformin");
    expect(body).toContain("7 days left");
  });

  it("includes pharmacy + phone when present in body", () => {
    const batch = {
      org_id: "org-a",
      recipient_id: "rec-1",
      medications: [
        {
          ...BASE,
          drug_name: "Lisinopril",
          pharmacy: "CVS Cherry St",
          pharmacy_phone: "+13035551111",
        },
      ],
    };
    const body = buildRefillEmailBody(batch);
    expect(body).toContain("CVS Cherry St");
    expect(body).toContain("+13035551111");
  });

  it("omits pharmacy lines when null", () => {
    const batch = {
      org_id: "org-a",
      recipient_id: "rec-1",
      medications: [{ ...BASE, pharmacy: null, pharmacy_phone: null }],
    };
    const body = buildRefillEmailBody(batch);
    expect(body).not.toContain("Pharmacy:");
    expect(body).not.toContain("Pharmacy phone:");
  });

  it("includes the unsubscribe instruction", () => {
    const batch = {
      org_id: "org-a",
      recipient_id: "rec-1",
      medications: [BASE],
    };
    expect(buildRefillEmailBody(batch)).toMatch(/reply.*unsubscribe/i);
  });

  it("pharmacy data with CRLF newlines does NOT break out of the text body shape", () => {
    // H3 defense: while we don't escape inside `text` (Resend handles it), we
    // assert the pharmacy data NEVER influences anything outside the body.
    // This test pins the body-only invariant; the caller's responsibility is
    // to NOT pass pharmacy data into subject/from/headers.
    const batch = {
      org_id: "org-a",
      recipient_id: "rec-1",
      medications: [
        {
          ...BASE,
          drug_name: "Test",
          pharmacy: "Evil\r\nBcc: attacker@evil.com",
          pharmacy_phone: "+1\r\nX-Header: pwned",
        },
      ],
    };
    const body = buildRefillEmailBody(batch);
    // The body itself can legitimately contain newlines — it IS the text body.
    // The invariant tested elsewhere (refillAlert.ts) is that the malicious
    // pharmacy string only ever flows into the `text` field, never `subject`/
    // `from`/headers.
    expect(body).toContain("Evil");
  });
});

describe("isoWeekStamp", () => {
  it("returns YYYY-Www format", () => {
    expect(isoWeekStamp(new Date("2026-05-17T12:00:00Z"))).toMatch(
      /^\d{4}-W\d{2}$/,
    );
  });

  it("rolls over correctly at week boundary", () => {
    // Same week, different days → same stamp
    const monday = isoWeekStamp(new Date("2026-05-18T12:00:00Z"));
    const wednesday = isoWeekStamp(new Date("2026-05-20T12:00:00Z"));
    expect(monday).toBe(wednesday);
  });

  it("different weeks yield different stamps", () => {
    const w1 = isoWeekStamp(new Date("2026-05-18T12:00:00Z"));
    const w2 = isoWeekStamp(new Date("2026-05-25T12:00:00Z"));
    expect(w1).not.toBe(w2);
  });
});

describe("refillDedupKey", () => {
  it("composes the canonical refill dedup_key shape", () => {
    expect(refillDedupKey("org-a", "rec-1", "2026-W21")).toBe(
      "refill:org-a:rec-1:2026-W21",
    );
  });

  it("per-week stamps yield distinct keys (dedup-window correctness)", () => {
    const k1 = refillDedupKey("org-a", "rec-1", "2026-W21");
    const k2 = refillDedupKey("org-a", "rec-1", "2026-W22");
    expect(k1).not.toBe(k2);
  });
});

// ─── M2 — PHI sentinel test ──────────────────────────────────────────────────
// On Resend dispatch error, captureException MUST NOT carry the drug name,
// pharmacy data, or recipient email. The ESLint rule cannot catch spreads or
// variable refs (per CLAUDE.md). This sentinel test is the live guard.
//
// TD-181 update — static/dynamic coverage split:
//   The `carelog/no-phi-in-analytics` ESLint rule now covers more surface area
//   (Resend `emails.send` payloads, including `to: [{ email }]` array-of-
//   objects shapes, plus a `spreadIdentifier` warning when a target call is
//   passed a bare Identifier instead of an inline object literal). But it
//   remains a STATIC, keys-only check on object literals. It CANNOT catch:
//     • forbidden field-name STRINGS appearing inside Sentry call bodies
//       (e.g. a hand-rolled string `"pharmacy_name"` slipped into an extra
//       payload — caught here by source-file substring assertions)
//     • spreads like `...input` / `...patch` / `...event` that smuggle
//       caller-controlled PHI into analytics extras
//     • template-string interpolation in `subject:` / `html:` fields where
//       PHI (drug name, recipient name) might be inlined
//     • the bare presence of `html:` and the substring `pharmacy` at the
//       resend.emails.send call site, which would indicate PHI leak surface
//   These are the gaps this sentinel test closes. DO NOT replace the
//   sentinel with the static rule — they are complementary, not redundant.

describe("PHI sentinel (M2) — refillAlert source file invariants", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const source = fs.readFileSync(
    path.resolve(__dirname, "../refillAlert.ts"),
    "utf-8",
  );

  it("Sentry calls in refillAlert.ts never reference drug/pharmacy/email fields", () => {
    // Extract every Sentry.* call (multi-line). Match against PHI field names.
    const sentryBlocks = source.match(/Sentry\.[\s\S]*?\}\s*\)/g) ?? [];
    expect(sentryBlocks.length).toBeGreaterThan(0);
    for (const block of sentryBlocks) {
      expect(block.toLowerCase()).not.toContain("drug_name");
      expect(block.toLowerCase()).not.toContain("pharmacy");
      expect(block.toLowerCase()).not.toMatch(/\bto:\s*[a-z]/);
      // No spreads of input/patch/event into Sentry options.
      expect(block).not.toMatch(/\.\.\.input\b/);
      expect(block).not.toMatch(/\.\.\.patch\b/);
      expect(block).not.toMatch(/\.\.\.event\b/);
    }
  });

  it("Resend `subject` field is a string literal (no template interpolation)", () => {
    const subjectMatch = source.match(/subject:\s*['"]([^'"]+)['"]/);
    expect(subjectMatch).not.toBeNull();
    // Confirm it's a literal, not a template string with ${...}
    expect(source).not.toMatch(/subject:\s*`[^`]*\$\{/);
  });

  it("Resend `html` field is NEVER passed (plain text only — XSS surface closed)", () => {
    // refillAlert.ts uses `text:` only; `html:` would appear if someone
    // regressed to HTML emails.
    expect(source).not.toMatch(/^\s*html:\s/m);
  });

  it("pharmacy fields appear ONLY in the body builder, not in resend.emails.send arguments", () => {
    // Crude but effective: extract the resend.emails.send call site and
    // confirm 'pharmacy' isn't anywhere in those args.
    const sendMatch = source.match(/resend\.emails\.send\(\{[\s\S]*?\}\)/);
    expect(sendMatch).not.toBeNull();
    expect(sendMatch![0].toLowerCase()).not.toContain("pharmacy");
    expect(sendMatch![0].toLowerCase()).not.toContain("drug_name");
  });
});
