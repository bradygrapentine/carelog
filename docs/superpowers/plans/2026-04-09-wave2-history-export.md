# Wave 2 — P4-03: Full History Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a coordinator-only "Export full history" feature that downloads a care recipient's complete record (care events, symptom readings, medications, shifts, real name + DOB from vault) as JSON or PDF.

**Architecture:** Single `POST /api/export` route (no DB table — on-demand generation). Auth/role checks mirror `/api/brief`. Identity vault accessed exactly once via `supabaseAdmin` (service role). PDF rendered server-side with `@react-pdf/renderer`. `ExportButton` component handles format selector, date picker, and blob download entirely client-side.

**Tech Stack:** Next.js 16 API route (Node.js runtime), Zod validation, `@react-pdf/renderer` v4, Supabase (service role for vault + data reads), `authenticatedFetch` for client ↔ server communication.

---

## File Map

| File                                                   | Action | Responsibility                                        |
| ------------------------------------------------------ | ------ | ----------------------------------------------------- |
| `apps/web/package.json`                                | Modify | Add `@react-pdf/renderer` dependency                  |
| `packages/schemas/src/export.ts`                       | Create | `exportRequestSchema` Zod shape                       |
| `packages/schemas/src/index.ts`                        | Modify | Re-export from `./export`                             |
| `apps/web/app/api/export/route.ts`                     | Create | Auth, role check, data fetch, JSON + PDF response     |
| `apps/web/app/api/export/ExportDocument.tsx`           | Create | React PDF document component (server-only)            |
| `apps/web/app/api/export/route.test.ts`                | Create | Auth/role/format/data-shape tests                     |
| `apps/web/app/journal/[recipientId]/ExportButton.tsx`  | Create | Coordinator-only download UI                          |
| `apps/web/app/journal/[recipientId]/JournalClient.tsx` | Modify | Import + render `ExportButton` after care brief block |

---

## Task 1: Schema + Package Install

**Files:**

- Modify: `apps/web/package.json`
- Create: `packages/schemas/src/export.ts`
- Modify: `packages/schemas/src/index.ts`

- [ ] **Step 1: Install `@react-pdf/renderer`**

```bash
cd apps/web && pnpm add @react-pdf/renderer
```

Expected: package added to `apps/web/package.json` under `dependencies`.

- [ ] **Step 2: Create `packages/schemas/src/export.ts`**

```typescript
import { z } from "zod";

export const exportRequestSchema = z.object({
  orgId: z.string().uuid(),
  recipientId: z.string().uuid(),
  format: z.enum(["json", "pdf"]),
  since: z.string().datetime({ offset: true }).optional(),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;
```

- [ ] **Step 3: Re-export from `packages/schemas/src/index.ts`**

Add to the end of the file:

```typescript
export * from "./export";
```

- [ ] **Step 4: Run schema typecheck**

```bash
cd /path/to/project && pnpm vitest run packages/schemas
```

Expected: all schema tests pass (no new tests needed for this schema — the route tests in Task 2 cover validation).

- [ ] **Step 5: Commit**

```bash
git add packages/schemas/src/export.ts packages/schemas/src/index.ts apps/web/package.json
git commit -m "chore: add export schema + @react-pdf/renderer"
```

---

## Task 2: Failing API Route Tests

**Files:**

- Create: `apps/web/app/api/export/route.test.ts`

Write all tests before any implementation. They must fail with "module not found" or "is not a function".

- [ ] **Step 1: Create `apps/web/app/api/export/route.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabaseServer", () => ({
  getRequestUser: vi.fn(),
}));
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));

import { getRequestUser } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { POST } from "./route";

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const REC_ID = "20000000-0000-0000-0000-000000000002";
const USER_ID = "30000000-0000-0000-0000-000000000003";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Helper: build a supabaseAdmin.from chain with .single() returning result
function makeChain(result: object) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    not: () => chain,
    gte: () => chain,
    order: () => chain,
    limit: vi.fn().mockResolvedValue(result),
  };
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

const BASE_BODY = { orgId: ORG_ID, recipientId: REC_ID, format: "json" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("POST /api/export — auth", () => {
  it("returns 401 when no user", async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null);
    const res = await POST(makeReq(BASE_BODY));
    expect(res.status).toBe(401);
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe("POST /api/export — validation", () => {
  it("returns 400 for missing orgId", async () => {
    const res = await POST(makeReq({ recipientId: REC_ID, format: "json" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid format value", async () => {
    const res = await POST(makeReq({ ...BASE_BODY, format: "xml" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid since (non-ISO)", async () => {
    const res = await POST(makeReq({ ...BASE_BODY, since: "yesterday" }));
    expect(res.status).toBe(400);
  });
});

// ─── Role enforcement ────────────────────────────────────────────────────────

describe("POST /api/export — role", () => {
  it("returns 403 when role is caregiver", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeChain({
        data: { role: "caregiver", accepted_at: new Date().toISOString() },
        error: null,
      }),
    );
    const res = await POST(makeReq(BASE_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 403 when membership is null (non-member)", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeChain({ data: null, error: { message: "not found" } }),
    );
    const res = await POST(makeReq(BASE_BODY));
    expect(res.status).toBe(403);
  });
});

// ─── JSON export ──────────────────────────────────────────────────────────────

describe("POST /api/export — JSON format", () => {
  it("returns 200 application/json with correct top-level keys", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      // Call 1: membership check
      if (callCount === 1)
        return makeChain({
          data: { role: "coordinator", accepted_at: new Date().toISOString() },
          error: null,
        });
      // Call 2: care_recipients (identity_token)
      if (callCount === 2)
        return makeChain({
          data: { identity_token: "vault-token-abc" },
          error: null,
        });
      // Call 3: identity_vault
      if (callCount === 3)
        return makeChain({
          data: { full_name: "Alice Smith", dob: "1940-06-01" },
          error: null,
        });
      // Calls 4-7: care_events, symptom_readings, medications, shifts
      const chain = makeChain({ data: [], error: null });
      return chain;
    });

    const res = await POST(makeReq(BASE_BODY));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const body = await res.json();
    expect(body).toHaveProperty("recipient_name", "Alice Smith");
    expect(body).toHaveProperty("dob", "1940-06-01");
    expect(body).toHaveProperty("care_events");
    expect(body).toHaveProperty("symptom_readings");
    expect(body).toHaveProperty("medications");
    expect(body).toHaveProperty("shifts");
    expect(body).toHaveProperty("exported_at");
  });
});
```

- [ ] **Step 2: Run tests — confirm they all fail**

```bash
pnpm vitest run apps/web/app/api/export/route.test.ts
```

Expected: all 7 tests fail with import error (route.ts doesn't exist yet).

- [ ] **Step 3: Commit failing tests**

```bash
git add apps/web/app/api/export/route.test.ts
git commit -m "test: failing tests for /api/export route"
```

---

## Task 3: Implement Export Route (JSON)

**Files:**

- Create: `apps/web/app/api/export/route.ts`

- [ ] **Step 1: Create `apps/web/app/api/export/route.ts`**

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { rateLimit } from "@/lib/rateLimit";
import { exportRequestSchema } from "@carelog/schemas";

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, "history/export");
    if (limited) return limited;

    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = exportRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { orgId, recipientId, format, since } = parsed.data;

    // ── 1. Role check (coordinator only) ──────────────────────────────────────
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("memberships")
      .select("role, accepted_at")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single();

    if (
      membershipError ||
      !membership ||
      membership.role !== "coordinator" ||
      !membership.accepted_at
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── 2. Resolve identity (vault — service role only) ───────────────────────
    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from("care_recipients")
      .select("identity_token")
      .eq("id", recipientId)
      .eq("org_id", orgId)
      .single();

    if (recipientError || !recipient) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 },
      );
    }

    const { data: vault, error: vaultError } = await supabaseAdmin
      .from("identity_vault")
      .select("full_name, dob")
      .eq("token", recipient.identity_token)
      .single();

    if (vaultError || !vault) {
      return NextResponse.json(
        { error: "Identity not found" },
        { status: 404 },
      );
    }

    // ── 3. Fetch data (all tables scoped to org + recipient + since filter) ───
    const sinceFilter = since ?? new Date(0).toISOString(); // epoch = no lower bound

    const [eventsRes, symptomsRes, medsRes, shiftsRes] = await Promise.all([
      supabaseAdmin
        .from("care_events")
        .select("id, event_type, entry_kind, occurred_at, flagged, payload")
        .eq("org_id", orgId)
        .eq("recipient_id", recipientId)
        .gte("occurred_at", sinceFilter)
        .order("occurred_at", { ascending: true })
        .limit(1000),

      supabaseAdmin
        .from("symptom_readings")
        .select("id, pain_level, mood, appetite, mobility, notes, recorded_at")
        .eq("org_id", orgId)
        .eq("recipient_id", recipientId)
        .gte("recorded_at", sinceFilter)
        .order("recorded_at", { ascending: true })
        .limit(500),

      supabaseAdmin
        .from("medications")
        .select(
          "id, drug_name, dosage, form, instructions, prescriber, active, created_at",
        )
        .eq("org_id", orgId)
        .eq("recipient_id", recipientId)
        .order("created_at", { ascending: true })
        .limit(200),

      supabaseAdmin
        .from("shifts")
        .select("id, assignee_user_id, start_at, end_at, notes, status")
        .eq("org_id", orgId)
        .eq("recipient_id", recipientId)
        .gte("start_at", sinceFilter)
        .order("start_at", { ascending: true })
        .limit(500),
    ]);

    const exportPayload = {
      recipient_name: vault.full_name,
      dob: vault.dob ?? null,
      exported_at: new Date().toISOString(),
      since: since ?? null,
      care_events: eventsRes.data ?? [],
      symptom_readings: symptomsRes.data ?? [],
      medications: medsRes.data ?? [],
      shifts: shiftsRes.data ?? [],
    };

    // ── 4. Return JSON or PDF ─────────────────────────────────────────────────
    if (format === "json") {
      return new NextResponse(JSON.stringify(exportPayload, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="care-history.json"',
        },
      });
    }

    // PDF: handled in Task 4
    return NextResponse.json(
      { error: "PDF not yet implemented" },
      { status: 501 },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Run tests — confirm JSON tests pass**

```bash
pnpm vitest run apps/web/app/api/export/route.test.ts
```

Expected: 7 tests pass (the JSON shape test plus all auth/role/validation tests).

- [ ] **Step 3: Run full suite — no regressions**

```bash
pnpm vitest run
```

Expected: all tests pass (430+).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/export/route.ts
git commit -m "feat: /api/export route — JSON format, coordinator-only"
```

---

## Task 4: PDF Format Support

**Files:**

- Create: `apps/web/app/api/export/ExportDocument.tsx`
- Modify: `apps/web/app/api/export/route.ts`

`@react-pdf/renderer` uses its own layout DSL (not HTML). Components must only use primitives from the library (`Document`, `Page`, `View`, `Text`). No Tailwind.

- [ ] **Step 1: Create `apps/web/app/api/export/ExportDocument.tsx`**

```tsx
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const s = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
  },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#6b7280", marginBottom: 24 },
  section: { marginBottom: 16 },
  sectionHead: {
    fontSize: 11,
    fontWeight: "bold",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 4,
    marginBottom: 8,
  },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 100, color: "#6b7280" },
  value: { flex: 1 },
  item: {
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 8,
  },
});

type ExportData = {
  recipient_name: string;
  dob: string | null;
  exported_at: string;
  since: string | null;
  care_events: any[];
  symptom_readings: any[];
  medications: any[];
  shifts: any[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ExportDocument({ data }: { data: ExportData }) {
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <Text style={s.title}>Care History — {data.recipient_name}</Text>
        <Text style={s.subtitle}>
          {"Exported " + formatDate(data.exported_at)}
          {data.dob ? " · DOB: " + data.dob : ""}
          {data.since ? " · Since: " + formatDate(data.since) : ""}
        </Text>

        {/* Medications */}
        <View style={s.section}>
          <Text style={s.sectionHead}>
            Medications ({data.medications.length})
          </Text>
          {data.medications.length === 0 && (
            <Text style={s.value}>No medications on record.</Text>
          )}
          {data.medications.map((m, i) => (
            <View key={i} style={s.item}>
              <View style={s.row}>
                <Text style={s.label}>Drug</Text>
                <Text style={s.value}>
                  {m.drug_name}
                  {m.active ? "" : " (inactive)"}
                </Text>
              </View>
              {m.dosage && (
                <View style={s.row}>
                  <Text style={s.label}>Dosage</Text>
                  <Text style={s.value}>{m.dosage}</Text>
                </View>
              )}
              {m.instructions && (
                <View style={s.row}>
                  <Text style={s.label}>Instructions</Text>
                  <Text style={s.value}>{m.instructions}</Text>
                </View>
              )}
              {m.prescriber && (
                <View style={s.row}>
                  <Text style={s.label}>Prescriber</Text>
                  <Text style={s.value}>{m.prescriber}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Symptom readings */}
        <View style={s.section}>
          <Text style={s.sectionHead}>
            Symptom Readings ({data.symptom_readings.length})
          </Text>
          {data.symptom_readings.length === 0 && (
            <Text style={s.value}>No symptom readings on record.</Text>
          )}
          {data.symptom_readings.map((r, i) => (
            <View key={i} style={s.item}>
              <View style={s.row}>
                <Text style={s.label}>Date</Text>
                <Text style={s.value}>{formatDate(r.recorded_at)}</Text>
              </View>
              {r.pain_level !== null && (
                <View style={s.row}>
                  <Text style={s.label}>Pain</Text>
                  <Text style={s.value}>{r.pain_level}/10</Text>
                </View>
              )}
              {r.mood && (
                <View style={s.row}>
                  <Text style={s.label}>Mood</Text>
                  <Text style={s.value}>{r.mood}</Text>
                </View>
              )}
              {r.appetite && (
                <View style={s.row}>
                  <Text style={s.label}>Appetite</Text>
                  <Text style={s.value}>{r.appetite}</Text>
                </View>
              )}
              {r.mobility && (
                <View style={s.row}>
                  <Text style={s.label}>Mobility</Text>
                  <Text style={s.value}>{r.mobility}</Text>
                </View>
              )}
              {r.notes && (
                <View style={s.row}>
                  <Text style={s.label}>Notes</Text>
                  <Text style={s.value}>{r.notes}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Shifts */}
        <View style={s.section}>
          <Text style={s.sectionHead}>Shifts ({data.shifts.length})</Text>
          {data.shifts.length === 0 && (
            <Text style={s.value}>No shifts on record.</Text>
          )}
          {data.shifts.map((sh, i) => (
            <View key={i} style={s.item}>
              <View style={s.row}>
                <Text style={s.label}>Start</Text>
                <Text style={s.value}>{formatDate(sh.start_at)}</Text>
              </View>
              {sh.end_at && (
                <View style={s.row}>
                  <Text style={s.label}>End</Text>
                  <Text style={s.value}>{formatDate(sh.end_at)}</Text>
                </View>
              )}
              <View style={s.row}>
                <Text style={s.label}>Status</Text>
                <Text style={s.value}>{sh.status}</Text>
              </View>
              {sh.notes && (
                <View style={s.row}>
                  <Text style={s.label}>Notes</Text>
                  <Text style={s.value}>{sh.notes}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Journal entries */}
        <View style={s.section}>
          <Text style={s.sectionHead}>
            Journal Entries (
            {
              data.care_events.filter((e: any) => e.entry_kind === "human")
                .length
            }
            )
          </Text>
          {data.care_events.filter((e: any) => e.entry_kind === "human")
            .length === 0 && (
            <Text style={s.value}>No journal entries on record.</Text>
          )}
          {data.care_events
            .filter((e: any) => e.entry_kind === "human")
            .map((e: any, i: number) => (
              <View key={i} style={s.item}>
                <View style={s.row}>
                  <Text style={s.label}>{formatDate(e.occurred_at)}</Text>
                  <Text style={s.value}>{e.payload?.text ?? ""}</Text>
                </View>
                {e.payload?.mood && (
                  <View style={s.row}>
                    <Text style={s.label}>Mood</Text>
                    <Text style={s.value}>{e.payload.mood}</Text>
                  </View>
                )}
                {e.flagged && (
                  <Text style={{ color: "#dc2626", fontSize: 9 }}>
                    ⚑ Flagged for follow-up
                  </Text>
                )}
              </View>
            ))}
        </View>

        <Text style={s.footer}>Generated by Carelog · {data.exported_at}</Text>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Add PDF branch to `apps/web/app/api/export/route.ts`**

Replace the last `if (format === 'json')` block (keep the JSON branch, replace the "501 not implemented" return):

```typescript
if (format === "pdf") {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const React = (await import("react")).default;
  const { ExportDocument } = await import("./ExportDocument");

  const buffer = await renderToBuffer(
    React.createElement(ExportDocument, { data: exportPayload }),
  );
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="care-history.pdf"',
    },
  });
}
```

Note: Dynamic import avoids bundling `@react-pdf/renderer` into the initial server bundle. `React.createElement` is used instead of JSX to keep the route file JSX-free (the JSX lives in `ExportDocument.tsx`).

- [ ] **Step 3: Add a PDF format test to `route.test.ts`**

Append this test block to `apps/web/app/api/export/route.test.ts`:

```typescript
describe("POST /api/export — PDF format", () => {
  it("returns 200 with application/pdf content-type", async () => {
    // Mock @react-pdf/renderer before the dynamic import resolves
    vi.mock("@react-pdf/renderer", () => ({
      renderToBuffer: vi
        .fn()
        .mockResolvedValue(Buffer.from("%PDF-1.4 fake-pdf")),
      Document: ({ children }: any) => children,
      Page: ({ children }: any) => children,
      View: ({ children }: any) => children,
      Text: ({ children }: any) => children,
      StyleSheet: { create: (s: any) => s },
    }));

    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeChain({
          data: { role: "coordinator", accepted_at: new Date().toISOString() },
          error: null,
        });
      if (callCount === 2)
        return makeChain({ data: { identity_token: "tok" }, error: null });
      if (callCount === 3)
        return makeChain({
          data: { full_name: "Alice", dob: null },
          error: null,
        });
      return makeChain({ data: [], error: null });
    });

    const res = await POST(makeReq({ ...BASE_BODY, format: "pdf" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/pdf");
  });
});
```

- [ ] **Step 4: Run tests — all 8 pass**

```bash
pnpm vitest run apps/web/app/api/export/route.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/export/ExportDocument.tsx apps/web/app/api/export/route.ts apps/web/app/api/export/route.test.ts
git commit -m "feat: PDF format support for /api/export"
```

---

## Task 5: ExportButton Component

**Files:**

- Create: `apps/web/app/journal/[recipientId]/ExportButton.tsx`

This is a client component. It POSTs to `/api/export` and triggers a blob download. All role-gating happens on the server; the component additionally hides itself for non-coordinators to avoid confusing the UI.

- [ ] **Step 1: Create `apps/web/app/journal/[recipientId]/ExportButton.tsx`**

```tsx
"use client";

import { useState } from "react";
import { authenticatedFetch } from "../../../lib/authenticatedFetch";

type Props = {
  orgId: string;
  recipientId: string;
  currentUserRole: string;
};

type Format = "json" | "pdf";

export function ExportButton({ orgId, recipientId, currentUserRole }: Props) {
  const [format, setFormat] = useState<Format>("json");
  const [since, setSince] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Server enforces coordinator-only; hide component for other roles
  if (currentUserRole !== "coordinator") return null;

  async function handleDownload(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const body: Record<string, string> = { orgId, recipientId, format };
    if (since) body.since = new Date(since).toISOString();

    const res = await authenticatedFetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setError("Export failed. Please try again.");
      setLoading(false);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = format === "json" ? "care-history.json" : "care-history.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setLoading(false);
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-4 py-3">
      <p className="text-sm font-medium text-gray-700 mb-3">
        Export full history
      </p>
      <form onSubmit={handleDownload} className="space-y-3">
        {/* Format */}
        <fieldset>
          <legend className="text-xs font-medium text-gray-600 mb-1.5">
            Format
          </legend>
          <div className="flex gap-2" role="group">
            {(["json", "pdf"] as Format[]).map((f) => {
              const isSelected = format === f;
              const cls =
                "px-3 py-1.5 text-xs font-medium rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 " +
                (isSelected
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300");
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={cls}
                  aria-pressed={isSelected}
                >
                  {f.toUpperCase()}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Date range */}
        <div>
          <label
            htmlFor="export-since"
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            From date{" "}
            <span className="font-normal text-gray-400">
              (optional — exports all history if empty)
            </span>
          </label>
          <input
            id="export-since"
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Preparing..." : "Download export"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/journal/[recipientId]/ExportButton.tsx"
git commit -m "feat: ExportButton component — format selector + date range + blob download"
```

---

## Task 6: Wire ExportButton into JournalClient

**Files:**

- Modify: `apps/web/app/journal/[recipientId]/JournalClient.tsx`

- [ ] **Step 1: Add import at top of JournalClient.tsx**

After the existing BurnoutCheckin import (line 17), add:

```typescript
import { ExportButton } from "./ExportButton";
```

- [ ] **Step 2: Render ExportButton after care brief section**

The care brief block ends with `</div>` at line 235. Insert after it, before the JournalTimeline block (line 237):

```tsx
{
  currentUserRole === "coordinator" && org && (
    <div className="mt-6">
      <ExportButton
        orgId={org.id}
        recipientId={recipientId}
        currentUserRole={currentUserRole}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify no type errors**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4: Run full test suite**

```bash
pnpm vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/journal/[recipientId]/JournalClient.tsx"
git commit -m "feat: wire ExportButton into JournalClient (coordinator only)"
```

---

## Task 7: QA Wave (Parallel)

Run four agents simultaneously after Task 6 is committed.

### 7a. Security subagent — `/review` on new code

Scope: `apps/web/app/api/export/route.ts`, `ExportDocument.tsx`, `ExportButton.tsx`.
Focus: vault access boundary (supabaseAdmin only), IDOR via orgId/recipientId, coordinator role check, rate limiting present, no PHI in client component.

### 7b. Test coverage subagent

Write any missing tests:

- `ExportButton.test.tsx` — renders for coordinator, returns null for caregiver, triggers POST on submit, shows error on failure, shows loading state
- Additional edge cases for `route.test.ts` — 404 when recipient not found, `since` filter applied

### 7c. Documentation update

Scan all new/changed files. Update:

- `docs/project-info/technology/BUILD_STATUS.md` — add P4-03 checkbox, update test count
- `docs/project-info/technology/BACKLOG_PHASE4.md` — mark P4-03 SHIPPED with date

### 7d. Final gate

After all QA agents complete:

1. Apply any critical fixes from 7a/7b findings
2. `pnpm vitest run` — all tests pass
3. Typecheck — zero errors
4. Commit any fixes

---

## Acceptance Criteria

- [ ] Coordinator can trigger a JSON export download (downloads `care-history.json`)
- [ ] Coordinator can trigger a PDF export download (downloads `care-history.pdf`)
- [ ] Non-coordinator role returns 403 from API
- [ ] Export includes: care_events, symptom_readings, medications, shifts
- [ ] Vault accessed exactly once per request — real name + DOB in output
- [ ] `since` date filter applies to care_events, symptom_readings, shifts
- [ ] All new Vitest tests pass; zero regressions
- [ ] Typecheck clean

---

## Known Constraints

- **No edge runtime** — `@react-pdf/renderer` requires Node.js; do NOT add `export const runtime = 'edge'` to the route
- **Turbopack rule** — no template literals in JSX props; ExportDocument uses string concatenation only
- **`any` types** — ExportDocument uses `any[]` for data arrays; acceptable since export is a read-only view
- **No export table** — export is generated on demand, not stored; this is intentional (avoids stale snapshots)
