import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAbortable } from "../useAbortable";

describe("useAbortable", () => {
  it("signal.aborted is false initially", () => {
    const { result } = renderHook(() => useAbortable());
    expect(result.current.signal.aborted).toBe(false);
    expect(result.current.isAborted).toBe(false);
  });

  it("signal.aborted is true after unmount (auto-abort on cleanup)", () => {
    const { result, unmount } = renderHook(() => useAbortable());
    const signal = result.current.signal;
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it("abort() immediately sets signal.aborted to true", () => {
    const { result } = renderHook(() => useAbortable());
    expect(result.current.isAborted).toBe(false);
    act(() => {
      result.current.abort();
    });
    expect(result.current.isAborted).toBe(true);
    expect(result.current.signal.aborted).toBe(true);
  });

  it("reset() yields a fresh non-aborted signal", () => {
    const { result } = renderHook(() => useAbortable());
    const originalSignal = result.current.signal;
    act(() => {
      result.current.reset();
    });
    // Old signal is aborted
    expect(originalSignal.aborted).toBe(true);
    // New signal is fresh
    expect(result.current.signal.aborted).toBe(false);
    expect(result.current.isAborted).toBe(false);
    expect(result.current.signal).not.toBe(originalSignal);
  });

  it("reset() followed by unmount aborts the new signal", () => {
    const { result, unmount } = renderHook(() => useAbortable());
    act(() => {
      result.current.reset();
    });
    const newSignal = result.current.signal;
    expect(newSignal.aborted).toBe(false);
    unmount();
    expect(newSignal.aborted).toBe(true);
  });
});
