import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDebouncedValue } from "../useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("returns the initial value synchronously", () => {
    const { result } = renderHook(() => useDebouncedValue("a", 200));
    expect(result.current).toBe("a");
  });

  it("waits delayMs before reflecting a new value", () => {
    const { result, rerender } = renderHook(
      ({ v }: { v: string }) => useDebouncedValue(v, 200),
      { initialProps: { v: "a" } },
    );
    rerender({ v: "b" });
    expect(result.current).toBe("a");
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe("a");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("b");
  });

  it("cancels in-flight timer when value changes again", () => {
    const { result, rerender } = renderHook(
      ({ v }: { v: string }) => useDebouncedValue(v, 200),
      { initialProps: { v: "a" } },
    );
    rerender({ v: "b" });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender({ v: "c" });
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe("a");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("c");
  });

  it("clears the timer on unmount", () => {
    const clearSpy = vi.spyOn(global, "clearTimeout");
    const { unmount, rerender } = renderHook(
      ({ v }: { v: string }) => useDebouncedValue(v, 200),
      { initialProps: { v: "a" } },
    );
    rerender({ v: "b" });
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
