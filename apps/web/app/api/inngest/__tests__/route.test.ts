/**
 * Tests for apps/web/app/api/inngest/route.ts
 *
 * Coverage goals:
 * - Route exports GET, POST, PUT handlers (serve() return shape)
 * - serve() is called with the inngest client and all 12 registered functions
 */

import { describe, it, expect, vi } from "vitest";

// ── mocks ───────────────────────────────────────────────────────────────────

const serveArgs: { client: unknown; functions: unknown[] }[] = [];

vi.mock("inngest/next", () => ({
  serve: vi.fn((args: { client: unknown; functions: unknown[] }) => {
    serveArgs.push(args);
    return {
      GET: vi.fn().mockResolvedValue(new Response("ok", { status: 200 })),
      POST: vi.fn().mockResolvedValue(new Response("ok", { status: 200 })),
      PUT: vi.fn().mockResolvedValue(new Response("ok", { status: 200 })),
    };
  }),
}));

vi.mock("../../../inngest/client", () => ({
  inngest: { id: "carelog" },
}));

vi.mock("../../../inngest/functions/weeklyDigest", () => ({
  weeklyDigest: { id: "weekly-digest" },
}));
vi.mock("../../../inngest/functions/gapDetector", () => ({
  gapDetector: { id: "gap-detector" },
}));
vi.mock("../../../inngest/functions/refillAlert", () => ({
  refillAlert: { id: "refill-alert" },
}));
vi.mock("../../../inngest/functions/ocrPrescription", () => ({
  ocrPrescription: { id: "ocr-prescription" },
}));
vi.mock("../../../inngest/functions/ocrDocument", () => ({
  ocrDocument: { id: "ocr-document" },
}));
vi.mock("../../../inngest/functions/burnoutAlert", () => ({
  burnoutAlert: { id: "burnout-alert" },
}));
vi.mock("../../../inngest/functions/journalFlagAlert", () => ({
  journalFlagAlert: { id: "journal-flag-alert" },
}));
vi.mock("../../../inngest/functions/documentsExtractText", () => ({
  documentsExtractText: { id: "documents-extract-text" },
}));
vi.mock("../../../inngest/functions/messagingPush", () => ({
  messagingPushFn: { id: "messaging-push" },
}));
vi.mock("../../../inngest/functions/careEventCommentFanout", () => ({
  careEventCommentFanoutFn: { id: "care-event-comment-fanout" },
}));
vi.mock("../../../inngest/functions/shiftTradeExpiry", () => ({
  shiftTradeExpiry: { id: "shift-trade-expiry" },
}));
vi.mock("../../../inngest/functions/educationTipRefresh", () => ({
  educationTipRefresh: { id: "education-tip-refresh" },
}));

// ── tests ────────────────────────────────────────────────────────────────────

await import("../route");

import { serve } from "inngest/next";

describe("Inngest route handler", () => {
  it("calls serve() exactly once at module load", () => {
    expect(vi.mocked(serve)).toHaveBeenCalledOnce();
  });

  it("passes the inngest client to serve()", () => {
    const [{ client }] = vi.mocked(serve).mock.calls[0]!;
    expect((client as unknown as { id: string }).id).toBe("carelog");
  });

  it("registers exactly 15 Inngest functions", () => {
    const [{ functions }] = vi.mocked(serve).mock.calls[0]!;
    expect((functions as unknown[]).length).toBe(15);
  });

  it("route exports GET handler", async () => {
    const mod = await import("../route");
    expect(typeof mod.GET).toBe("function");
  });

  it("route exports POST handler", async () => {
    const mod = await import("../route");
    expect(typeof mod.POST).toBe("function");
  });

  it("route exports PUT handler", async () => {
    const mod = await import("../route");
    expect(typeof mod.PUT).toBe("function");
  });
});
