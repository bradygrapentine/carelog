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

  it("onCancel — invoked after cancel() with hook in closed state when act() flushes (TD-188 ordering)", () => {
    // TD-188: flushSync removed. onCancel runs synchronously after the
    // setters are queued. Once React flushes (end of act()), isEditing/error
    // observe the post-close values. The contract guarantees onCancel fires
    // exactly once per cancel(), and that AFTER act() completes the hook is
    // closed — that's what the UI cares about. Callers must NOT read
    // isEditing synchronously from inside onCancel.
    const onCancel = vi.fn();

    const { result } = renderHook(() => useEditMode({ onCancel }));

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
    expect(result.current.isEditing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("TD-188: cancel() does NOT emit a React warning when onCancel triggers a parent state update", () => {
    // Regression for the flushSync-related "Cannot update a component while
    // rendering a different component" warning that prompted TD-188. With
    // flushSync removed, dispatching a parent setter from inside onCancel
    // must not log a console.error from React.
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    let parentSetterCallCount = 0;
    const parentSetter = vi.fn(() => {
      parentSetterCallCount += 1;
    });

    const { result } = renderHook(() =>
      useEditMode({
        onCancel: () => {
          // Simulate a parent state mutation triggered from inside onCancel.
          parentSetter();
        },
      }),
    );

    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.cancel();
    });

    expect(parentSetterCallCount).toBe(1);
    // TD-191 item 2: tightened from `/react|warning/i` regex to an explicit
    // "no console.error calls at all". The old filter would have missed real
    // React 19 warnings whose first arg doesn't contain "react" or "warning"
    // literally (e.g. "Cannot update a component (X) while rendering a
    // different component (Y)..."). Asserting zero calls catches every
    // unexpected console.error path — including future warning copy changes.
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("TD-191 item 2: regression — warnings without 'react'/'warning' literal still flagged", () => {
    // Pin the regression guard. The pre-TD-191 filter used /react|warning/i;
    // a real React 19 warning like "Cannot update a component (X) while
    // rendering a different component (Y)" contains neither token literally
    // and would have been silently dropped. We assert that consoleErrorSpy
    // IS called when the message contains no filter-matching token — so the
    // tightened `not.toHaveBeenCalled()` assertion above could not have
    // false-passed historically.
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    // Emit a representative React 19 warning shape with no "react"/"warning" literal.
    console.error(
      "Cannot update a component (X) while rendering a different component (Y).",
    );
    const oldFilter = consoleErrorSpy.mock.calls.filter((call) => {
      const first = call[0];
      return typeof first === "string" && /react|warning/i.test(first);
    });
    expect(oldFilter).toHaveLength(0); // old filter would have missed it
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // new assertion catches it
    consoleErrorSpy.mockRestore();
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
