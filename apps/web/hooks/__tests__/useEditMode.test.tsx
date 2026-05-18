import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useEditMode } from "../useEditMode";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

describe("useEditMode", () => {
  beforeEach(() => {
    refreshMock.mockClear();
  });

  it("starts closed with no error", () => {
    const { result } = renderHook(() => useEditMode());
    expect(result.current.isEditing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("open() sets isEditing to true and clears any prior error", () => {
    const { result } = renderHook(() => useEditMode());
    act(() => {
      result.current.handlers.onError({ message: "boom" });
    });
    expect(result.current.error).toBe("boom");
    act(() => {
      result.current.open();
    });
    expect(result.current.isEditing).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("cancel() resets isEditing to false and clears error", () => {
    const { result } = renderHook(() => useEditMode());
    act(() => {
      result.current.open();
      result.current.handlers.onError({ message: "x" });
    });
    expect(result.current.isEditing).toBe(true);
    expect(result.current.error).toBe("x");
    act(() => {
      result.current.cancel();
    });
    expect(result.current.isEditing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("default onSuccessRefresh: true — handlers.onSuccess() closes and calls router.refresh()", () => {
    const { result } = renderHook(() => useEditMode());
    act(() => {
      result.current.open();
    });
    expect(result.current.isEditing).toBe(true);
    act(() => {
      result.current.handlers.onSuccess();
    });
    expect(result.current.isEditing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("handlers.onError({ message }) sets error and keeps isEditing true", () => {
    const { result } = renderHook(() => useEditMode());
    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.handlers.onError({ message: "boom" });
    });
    expect(result.current.error).toBe("boom");
    expect(result.current.isEditing).toBe(true);
  });

  it("onSuccessRefresh: false — handlers.onSuccess() closes but does NOT call router.refresh()", () => {
    const { result } = renderHook(() =>
      useEditMode({ onSuccessRefresh: false }),
    );
    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.handlers.onSuccess();
    });
    expect(result.current.isEditing).toBe(false);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("onCancel — invoked AFTER isEditing flips to false and error is cleared (LOCKED ordering)", () => {
    // Capture closure-visible state at the moment onCancel fires. The hook
    // promises that cancel() updates state FIRST, then invokes onCancel. By
    // recording values reachable from the cancel() callback site, we observe
    // the ordering.
    let sawIsEditingBeforeFlip: boolean | null = null;
    const onCancel = vi.fn(() => {
      // result.current.isEditing reflects the latest committed state when
      // React batches synchronously inside `act()`. After cancel() runs its
      // setters, the closure here can re-read state via the ref captured
      // below.
      sawIsEditingBeforeFlip = capturedHookRef.current?.isEditing ?? null;
    });

    const capturedHookRef: { current: ReturnType<typeof useEditMode> | null } = {
      current: null,
    };

    const { result } = renderHook(() => {
      const hook = useEditMode({ onCancel });
      capturedHookRef.current = hook;
      return hook;
    });

    act(() => {
      result.current.open();
      result.current.handlers.onError({ message: "boom" });
    });
    expect(result.current.isEditing).toBe(true);
    expect(result.current.error).toBe("boom");

    act(() => {
      result.current.cancel();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    // Inside the onCancel body, the freshest committed React state already
    // shows the post-close values — proving the setters ran first.
    expect(sawIsEditingBeforeFlip).toBe(false);
    expect(result.current.isEditing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("onCancel — omitted: cancel() still flips closed without throwing", () => {
    const { result } = renderHook(() => useEditMode());
    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.cancel();
    });
    expect(result.current.isEditing).toBe(false);
  });
});
