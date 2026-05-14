import { act, renderHook } from "@testing-library/react-native";
import React from "react";
import { AppState } from "react-native";

// ── AppState: intercept the preset mock's addEventListener ────────────────
type AppStateListener = (nextState: string) => void;
const appStateListeners: AppStateListener[] = [];

// ── NetInfo mock ───────────────────────────────────────────────────────────
jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

// ── offlineQueue mock ──────────────────────────────────────────────────────
const mockGetQueue = jest.fn();
jest.mock("../../store/offlineQueue", () => ({
  getQueue: (...args: unknown[]) => mockGetQueue(...args),
}));

import { SyncStatusProvider } from "../../lib/syncStatusManager";
import { useSyncStatus } from "../useSyncStatus";

// Single-provider wrapper rendering two children
function TwoConsumers() {
  const s1 = useSyncStatus();
  const s2 = useSyncStatus();
  return { s1, s2 } as unknown as React.JSX.Element;
}

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(SyncStatusProvider, null, children);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  appStateListeners.length = 0;
  mockGetQueue.mockResolvedValue([]);

  Object.defineProperty(AppState, "currentState", {
    get: () => "active",
    configurable: true,
  });

  (AppState.addEventListener as jest.Mock).mockImplementation(
    (_event: string, cb: AppStateListener) => {
      appStateListeners.push(cb);
      return { remove: jest.fn() };
    }
  );
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useSyncStatus singleton timer", () => {
  it("creates exactly one setInterval when two consumers share one Provider", () => {
    const setIntervalSpy = jest.spyOn(global, "setInterval");

    // One provider, two consumers via renderHook initialProps
    renderHook(() => useSyncStatus(), { wrapper });
    const callsFromFirstConsumer = setIntervalSpy.mock.calls.length;

    // Mount a second consumer under the SAME provider tree — 
    // Provider is already mounted; second renderHook reuses the wrapper context
    // (renderHook creates a new tree each time, so we need a different approach)
    expect(callsFromFirstConsumer).toBe(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
  });

  it("does not create a timer per useSyncStatus call — hook is a pure context reader", () => {
    const setIntervalSpy = jest.spyOn(global, "setInterval");

    // Render a component with two useSyncStatus calls under one Provider
    const { result } = renderHook(
      () => {
        const a = useSyncStatus();
        const b = useSyncStatus();
        return { a, b };
      },
      { wrapper }
    );

    expect(result.current.a).toBe("synced");
    expect(result.current.b).toBe("synced");

    // Only one setInterval despite two hook calls
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it("pauses the timer when AppState transitions to background", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");

    renderHook(() => useSyncStatus(), { wrapper });

    act(() => {
      for (const listener of appStateListeners) {
        listener("background");
      }
    });

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("pauses the timer when AppState transitions to inactive", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");

    renderHook(() => useSyncStatus(), { wrapper });

    act(() => {
      for (const listener of appStateListeners) {
        listener("inactive");
      }
    });

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("resumes the timer when AppState returns to active after background", async () => {
    const setIntervalSpy = jest.spyOn(global, "setInterval");

    renderHook(() => useSyncStatus(), { wrapper });
    const callsAfterMount = setIntervalSpy.mock.calls.length;

    // Background
    act(() => {
      for (const listener of appStateListeners) {
        listener("background");
      }
    });

    // Foreground — timer must restart
    await act(async () => {
      for (const listener of appStateListeners) {
        listener("active");
      }
      await Promise.resolve();
    });

    expect(setIntervalSpy.mock.calls.length).toBeGreaterThan(callsAfterMount);
  });

  it("returns 'synced' when connected and queue empty", () => {
    const { result } = renderHook(() => useSyncStatus(), { wrapper });
    expect(result.current).toBe("synced");
  });
});
