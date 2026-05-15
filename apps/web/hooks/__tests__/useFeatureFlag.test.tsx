import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useFeatureFlagEnabled } from "posthog-js/react";

// Mock posthog-js/react — factory must not reference top-level variables
vi.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: vi.fn(),
}));

describe("useFeatureFlag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when PostHog reports the flag as enabled", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValueOnce(true);

    const { result } = renderHook(() => useFeatureFlag("feature_test_flag"));

    expect(result.current).toBe(true);
    expect(useFeatureFlagEnabled).toHaveBeenCalledWith("feature_test_flag");
  });

  it("returns false when PostHog reports the flag as disabled", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValueOnce(false);

    const { result } = renderHook(() => useFeatureFlag("feature_test_flag"));

    expect(result.current).toBe(false);
  });

  it("returns false (fail-closed) when PostHog returns undefined (not yet loaded)", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValueOnce(undefined);

    const { result } = renderHook(() => useFeatureFlag("feature_test_flag"));

    expect(result.current).toBe(false);
  });
});
