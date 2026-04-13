import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSendPush } = vi.hoisted(() => ({
  mockSendPush: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../pushNotification", () => ({
  sendPushToOrgCoordinators: mockSendPush,
}));

import {
  handleFlagAlert,
  journalFlaggedEventSchema,
} from "../journalFlagAlert";

const ORG = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const EVT = "28dc6d19-6712-4b26-8797-b4e544e01b84";
const REC = "38dc6d19-6712-4b26-8797-b4e544e01b84";

describe("handleFlagAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls sendPushToOrgCoordinators with correct args", async () => {
    await handleFlagAlert({ orgId: ORG, eventId: EVT, recipientId: REC });
    expect(mockSendPush).toHaveBeenCalledWith(ORG, {
      title: "Entry flagged for doctor",
      body: "A journal entry has been flagged — tap to review.",
      data: { eventId: EVT, screen: "journal" },
    });
  });
});

describe("journalFlaggedEventSchema (R2-014)", () => {
  it("accepts valid event payload", () => {
    expect(() =>
      journalFlaggedEventSchema.parse({
        orgId: ORG,
        eventId: EVT,
        recipientId: REC,
      }),
    ).not.toThrow();
  });

  it("rejects non-UUID orgId (forged event)", () => {
    expect(() =>
      journalFlaggedEventSchema.parse({
        orgId: "not-a-uuid",
        eventId: EVT,
        recipientId: REC,
      }),
    ).toThrow();
  });

  it("rejects missing recipientId", () => {
    expect(() =>
      journalFlaggedEventSchema.parse({ orgId: ORG, eventId: EVT }),
    ).toThrow();
  });

  it("rejects unknown extra keys (strict)", () => {
    expect(() =>
      journalFlaggedEventSchema.parse({
        orgId: ORG,
        eventId: EVT,
        recipientId: REC,
        injected: "x",
      }),
    ).toThrow();
  });
});
