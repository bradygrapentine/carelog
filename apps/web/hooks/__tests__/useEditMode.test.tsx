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
});
