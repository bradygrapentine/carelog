import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabaseServer
const mockGetUser = vi.fn();
vi.mock("@/lib/supabaseServer", () => ({
  createServerSupabase: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
      },
    }),
  ),
}));

// Mock posthog-server
const mockIsFeatureEnabled = vi.fn();
vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: vi.fn(() => ({
    isFeatureEnabled: mockIsFeatureEnabled,
  })),
}));

import { getFeatureFlag } from "./featureFlags";

describe("getFeatureFlag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when PostHog reports enabled and user is authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "uuid-1234-anon" } },
    });
    mockIsFeatureEnabled.mockResolvedValueOnce(true);

    const result = await getFeatureFlag("feature_test_flag");

    expect(result).toBe(true);
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith(
      "feature_test_flag",
      "uuid-1234-anon",
    );
  });

  it("returns false when PostHog reports disabled", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "uuid-1234-anon" } },
    });
    mockIsFeatureEnabled.mockResolvedValueOnce(false);

    const result = await getFeatureFlag("feature_test_flag");

    expect(result).toBe(false);
  });

  it("returns false when PostHog throws (fail-closed)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "uuid-1234-anon" } },
    });
    mockIsFeatureEnabled.mockRejectedValueOnce(
      new Error("PostHog unreachable"),
    );

    const result = await getFeatureFlag("feature_test_flag");

    expect(result).toBe(false);
  });

  it("returns false and does NOT call isFeatureEnabled when there is no authenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
    });

    const result = await getFeatureFlag("feature_test_flag");

    expect(result).toBe(false);
    // Critical: no distinctId path — isFeatureEnabled must NOT be called
    expect(mockIsFeatureEnabled).not.toHaveBeenCalled();
  });
});
