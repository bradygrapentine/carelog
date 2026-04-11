import { renderHook, act } from "@testing-library/react-native";
import { useOfflineWrite } from "../useOfflineWrite";
import { getQueue, enqueue, dequeue } from "../../store/offlineQueue";
import type { OfflineEntryKind } from "../../store/offlineQueue";

// Mock NetInfo
const netInfoListeners: Array<(s: { isConnected: boolean }) => void> = [];
jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn((cb: (s: { isConnected: boolean }) => void) => {
    netInfoListeners.push(cb);
    return jest.fn();
  }),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

// Mock offlineQueue
jest.mock("../../store/offlineQueue", () => ({
  enqueue: jest.fn().mockResolvedValue(undefined),
  dequeue: jest.fn().mockResolvedValue(undefined),
  incrementAttempts: jest.fn().mockResolvedValue(undefined),
  getQueue: jest.fn().mockResolvedValue([]),
}));

// Mock tRPC — track which mutation was called
const mockCareEventsInsert = jest.fn().mockResolvedValue({ id: "ce-1" });
const mockMedLogAdmin = jest.fn().mockResolvedValue({ id: "ml-1" });
const mockSymptomsLog = jest.fn().mockResolvedValue({ ok: true });

jest.mock("../../utils/trpc", () => ({
  trpc: {
    careEvents: {
      insert: { useMutation: () => ({ mutateAsync: mockCareEventsInsert }) },
    },
    medications: {
      logAdministration: {
        useMutation: () => ({ mutateAsync: mockMedLogAdmin }),
      },
    },
    symptoms: {
      log: { useMutation: () => ({ mutateAsync: mockSymptomsLog }) },
    },
  },
}));

// Suppress React wrapper warning — we're testing the hook in isolation
jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return { ...actual };
});

beforeEach(() => {
  jest.clearAllMocks();
  netInfoListeners.length = 0;
  (getQueue as jest.Mock).mockResolvedValue([]);
});

describe("useOfflineWrite", () => {
  it("enqueues a journal_entry and flushes via careEvents.insert when online", async () => {
    const { result } = renderHook(() => useOfflineWrite("org-1"));

    // Simulate enqueue then flush for journal_entry
    (getQueue as jest.Mock).mockResolvedValueOnce([
      {
        id: "uuid-1",
        event_type: "journal",
        entry_kind: "journal_entry",
        payload: { text: "hello", mood: "good" },
        recipient_id: "r1",
        occurred_at: "2026-04-11T12:00:00Z",
        attempts: 0,
      },
    ]);

    await act(async () => {
      await result.current.write({
        event_type: "journal",
        entry_kind: "journal_entry",
        payload: { text: "hello", mood: "good" },
        recipient_id: "r1",
      });
    });

    expect(enqueue).toHaveBeenCalled();
    expect(mockCareEventsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        recipientId: "r1",
        eventType: "journal",
        entryKind: "human",
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it("enqueues a medication_log and flushes via medications.logAdministration when online", async () => {
    const { result } = renderHook(() => useOfflineWrite("org-1"));

    (getQueue as jest.Mock).mockResolvedValueOnce([
      {
        id: "uuid-2",
        event_type: "medication",
        entry_kind: "medication_log",
        payload: {
          medication_id: "m1",
          scheduled_time: "08:00",
          action: "given",
        },
        recipient_id: "r1",
        occurred_at: "2026-04-11T08:00:00Z",
        attempts: 0,
      },
    ]);

    await act(async () => {
      await result.current.write({
        event_type: "medication",
        entry_kind: "medication_log",
        payload: {
          medication_id: "m1",
          scheduled_time: "08:00",
          action: "given",
        },
        recipient_id: "r1",
      });
    });

    expect(mockMedLogAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: "org-1",
        recipient_id: "r1",
        medication_id: "m1",
        scheduled_time: "08:00",
        action: "given",
      }),
    );
  });

  it("enqueues a symptom_reading and flushes via symptoms.log when online", async () => {
    const { result } = renderHook(() => useOfflineWrite("org-1"));

    (getQueue as jest.Mock).mockResolvedValueOnce([
      {
        id: "uuid-3",
        event_type: "symptom",
        entry_kind: "symptom_reading",
        payload: { pain_level: 5, mood: "okay" },
        recipient_id: "r1",
        occurred_at: "2026-04-11T14:00:00Z",
        attempts: 0,
      },
    ]);

    await act(async () => {
      await result.current.write({
        event_type: "symptom",
        entry_kind: "symptom_reading",
        payload: { pain_level: 5, mood: "okay" },
        recipient_id: "r1",
      });
    });

    expect(mockSymptomsLog).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: "org-1",
        recipient_id: "r1",
        pain_level: 5,
        mood: "okay",
      }),
    );
  });

  it("enqueues without flushing when offline", async () => {
    const NetInfo = require("@react-native-community/netinfo");
    NetInfo.fetch.mockResolvedValueOnce({ isConnected: false });

    const { result } = renderHook(() => useOfflineWrite("org-1"));

    await act(async () => {
      await result.current.write({
        event_type: "journal",
        entry_kind: "journal_entry",
        payload: { text: "offline entry" },
        recipient_id: "r1",
      });
    });

    expect(enqueue).toHaveBeenCalled();
    expect(mockCareEventsInsert).not.toHaveBeenCalled();
  });
});
