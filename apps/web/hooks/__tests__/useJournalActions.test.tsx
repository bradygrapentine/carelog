import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

// --- Mocks (vitest hoists vi.mock; only `mock`-prefixed vars may be referenced) ---
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => mockToastError(...a),
    success: (...a: unknown[]) => mockToastSuccess(...a),
  },
}));

const mockPushEntry = vi.fn();
vi.mock("../../lib/offline-queue", () => {
  class QueueFullError extends Error {}
  return {
    pushEntry: (...a: unknown[]) => mockPushEntry(...a),
    QueueFullError,
  };
});

vi.mock("../../lib/authenticatedFetch", () => ({
  authenticatedFetch: vi.fn(),
}));

import { useJournalActions } from "../useJournalActions";
import { QueueFullError } from "../../lib/offline-queue";

const ORG = { id: "org-1", name: "Org" };

function setup(isOnline: boolean) {
  return renderHook(() =>
    useJournalActions(
      ORG,
      "rec-1",
      "user-1",
      vi.fn().mockResolvedValue(undefined), // loadEvents
      isOnline,
      vi.fn().mockResolvedValue(undefined), // refreshQueueDepth
      vi.fn(), // setEvents
    ),
  );
}

describe("useJournalActions — TD-206 offline error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toasts a generic error when an offline save fails with a non-QueueFull error", async () => {
    mockPushEntry.mockRejectedValueOnce(new Error("indexeddb blew up"));
    const { result } = setup(false);
    await act(async () => {
      await result.current.handlePost("my private journal text", "good");
    });
    expect(mockToastError).toHaveBeenCalledWith(
      "Couldn't save offline — please try again.",
    );
    // PHI sentinel: the journal text/mood must never appear in the toast.
    const msg = String(mockToastError.mock.calls[0]?.[0] ?? "");
    expect(msg).not.toMatch(/my private journal text|good/);
  });

  it("toasts the queue-full message when offline save hits QueueFullError", async () => {
    mockPushEntry.mockRejectedValueOnce(new QueueFullError());
    const { result } = setup(false);
    await act(async () => {
      await result.current.handlePost("text", "okay");
    });
    expect(mockToastError).toHaveBeenCalledWith(
      "Offline queue is full. Connect to the internet to sync.",
    );
  });

  it("does not error-toast on a successful offline save", async () => {
    mockPushEntry.mockResolvedValueOnce(undefined);
    const { result } = setup(false);
    await act(async () => {
      await result.current.handlePost("text", "good");
    });
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalled();
  });
});
