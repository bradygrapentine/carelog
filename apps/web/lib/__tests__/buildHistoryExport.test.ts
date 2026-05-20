import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildHistoryExport,
  buildExportCounts,
  type HistoryExportSnapshot,
} from "../buildHistoryExport";

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const REC_ID = "22222222-2222-2222-2222-222222222222";

// Tables that resolve at .order() (array result, no .single()/.maybeSingle())
const ARRAY_TABLES = new Set([
  "care_events",
  "medications",
  "symptom_readings",
  "documents",
]);

function makeAdminMock(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    recipient: {
      data: { identity_token: "tok-abc" },
      error: null,
    },
    vault: {
      data: { full_name: "Jane Doe", dob: "1940-05-01" },
      error: null,
    },
    care_events: { data: [], error: null },
    medications: { data: [], error: null },
    symptom_readings: { data: [], error: null },
    eol_plan: { data: null, error: null },
    documents: { data: [], error: null },
    ...overrides,
  };

  const admin = {
    from: vi.fn((table: string) => {
      let result: unknown;
      if (table === "care_recipients") result = defaults.recipient;
      else if (table === "identity_vault") result = defaults.vault;
      else if (table === "care_events") result = defaults.care_events;
      else if (table === "medications") result = defaults.medications;
      else if (table === "symptom_readings") result = defaults.symptom_readings;
      else if (table === "eol_plans") result = defaults.eol_plan;
      else if (table === "documents") result = defaults.documents;
      else result = { data: [], error: null };

      const isArray = ARRAY_TABLES.has(table);
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        // For array tables .order() is the terminal call — return the promise
        order: isArray ? vi.fn().mockResolvedValue(result) : () => chain,
        single: vi.fn().mockResolvedValue(result),
        maybeSingle: vi.fn().mockResolvedValue(result),
      };
      return chain;
    }),
  };

  return admin;
}

describe("buildHistoryExport", () => {
  it("returns snapshot with de-tokenized name", async () => {
    const admin = makeAdminMock();
    const snapshot = await buildHistoryExport({
      orgId: ORG_ID,
      recipientId: REC_ID,
      supabaseAdmin: admin as any,
    });

    expect(snapshot.recipient_name).toBe("Jane Doe");
    expect(snapshot.dob).toBe("1940-05-01");
    expect(snapshot.recipient_id).toBe(REC_ID);
    expect(snapshot.generated_at).toBeTruthy();
  });

  it("throws when recipient not found", async () => {
    const admin = makeAdminMock({
      recipient: { data: null, error: { message: "not found" } },
    });
    await expect(
      buildHistoryExport({
        orgId: ORG_ID,
        recipientId: REC_ID,
        supabaseAdmin: admin as any,
      }),
    ).rejects.toThrow("Recipient not found");
  });

  it("throws when identity vault lookup fails", async () => {
    const admin = makeAdminMock({
      vault: { data: null, error: { message: "vault error" } },
    });
    await expect(
      buildHistoryExport({
        orgId: ORG_ID,
        recipientId: REC_ID,
        supabaseAdmin: admin as any,
      }),
    ).rejects.toThrow("Identity not found");
  });

  // TD-205: a query error on care_events/medications/symptom_readings must
  // throw (fail closed) — never silently return a snapshot missing that data.
  it.each([
    ["care_events", "Care events fetch failed"],
    ["medications", "Medications fetch failed"],
    ["symptom_readings", "Symptom readings fetch failed"],
  ])(
    "throws when %s query errors (no silent partial export)",
    async (table, message) => {
      const admin = makeAdminMock({
        [table]: { data: null, error: { message: "connection reset" } },
      });
      await expect(
        buildHistoryExport({
          orgId: ORG_ID,
          recipientId: REC_ID,
          supabaseAdmin: admin as any,
        }),
      ).rejects.toThrow(message);
    },
  );

  // TD-205 PHI sentinel: a thrown error must carry no recipient PHI (full_name,
  // dob) or raw DB error string — it propagates to the route's 500 + Sentry.
  it("thrown query error contains no PHI or raw DB string", async () => {
    const admin = makeAdminMock({
      care_events: {
        data: null,
        error: { message: "row for Jane Doe / 1940-05-01 failed" },
      },
    });
    let caught: Error | null = null;
    try {
      await buildHistoryExport({
        orgId: ORG_ID,
        recipientId: REC_ID,
        supabaseAdmin: admin as any,
      });
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toBe("Care events fetch failed");
    expect(caught!.message).not.toMatch(/Jane Doe|1940|connection|row for/i);
  });

  it("includes all tables in snapshot", async () => {
    const admin = makeAdminMock({
      care_events: {
        data: [
          {
            id: "ev-1",
            occurred_at: "2024-01-01T00:00:00Z",
            event_type: "journal",
            entry_kind: "human",
            payload: { text: "hello" },
            flagged: false,
            created_at: "2024-01-01T00:00:00Z",
          },
        ],
        error: null,
      },
      medications: {
        data: [
          {
            id: "med-1",
            drug_name: "Aspirin",
            dosage: "81mg",
            instructions: "Daily",
            active: true,
            created_at: "2024-01-01T00:00:00Z",
          },
        ],
        error: null,
      },
      symptom_readings: {
        data: [
          {
            id: "sr-1",
            recorded_at: "2024-01-02T00:00:00Z",
            reading_type: "blood_pressure",
            value: 120,
            unit: "mmHg",
            notes: null,
          },
        ],
        error: null,
      },
      eol_plan: {
        data: {
          id: "eol-1",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: null,
          content: {},
        },
        error: null,
      },
      documents: {
        data: [
          {
            id: "doc-1",
            created_at: "2024-01-01T00:00:00Z",
            file_name: "test.pdf",
            file_type: "application/pdf",
            uploaded_by: "user-1",
          },
        ],
        error: null,
      },
    });

    const snapshot = await buildHistoryExport({
      orgId: ORG_ID,
      recipientId: REC_ID,
      supabaseAdmin: admin as any,
    });

    expect(snapshot.care_events).toHaveLength(1);
    expect(snapshot.medications).toHaveLength(1);
    expect(snapshot.symptom_readings).toHaveLength(1);
    expect(snapshot.eol_plan).not.toBeNull();
    expect(snapshot.documents_metadata).toHaveLength(1);
  });

  it("handles null eol_plan gracefully", async () => {
    const admin = makeAdminMock({
      eol_plan: { data: null, error: null },
    });
    const snapshot = await buildHistoryExport({
      orgId: ORG_ID,
      recipientId: REC_ID,
      supabaseAdmin: admin as any,
    });
    expect(snapshot.eol_plan).toBeNull();
  });

  it("handles null dob gracefully", async () => {
    const admin = makeAdminMock({
      vault: {
        data: { full_name: "Jane Doe", dob: null },
        error: null,
      },
    });
    const snapshot = await buildHistoryExport({
      orgId: ORG_ID,
      recipientId: REC_ID,
      supabaseAdmin: admin as any,
    });
    expect(snapshot.dob).toBeNull();
  });
});

describe("buildExportCounts", () => {
  it("returns correct counts from snapshot", () => {
    const snapshot: HistoryExportSnapshot = {
      generated_at: "2024-01-01T00:00:00Z",
      recipient_id: REC_ID,
      recipient_name: "Jane Doe",
      dob: null,
      care_events: [
        {
          id: "1",
          occurred_at: "",
          event_type: "journal",
          entry_kind: "human",
          payload: null,
          flagged: false,
          created_at: "",
        },
        {
          id: "2",
          occurred_at: "",
          event_type: "medication",
          entry_kind: null,
          payload: null,
          flagged: false,
          created_at: "",
        },
      ],
      medications: [
        {
          id: "m1",
          drug_name: "Aspirin",
          dosage: null,
          instructions: null,
          active: true,
          created_at: "",
        },
      ],
      symptom_readings: [],
      eol_plan: {
        id: "e1",
        created_at: "",
        updated_at: null,
        content: null,
      },
      documents_metadata: [],
    };

    const counts = buildExportCounts(snapshot);
    expect(counts.care_events).toBe(2);
    expect(counts.medications).toBe(1);
    expect(counts.symptom_readings).toBe(0);
    expect(counts.eol_plan).toBe(true);
    expect(counts.documents_metadata).toBe(0);
  });
});
