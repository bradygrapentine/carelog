// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  exceeds429Threshold,
  type RateLimitWindow,
} from "../rateLimit429Monitor";

const BASE: RateLimitWindow = {
  total_requests: 1000,
  requests_429: 0,
  window_stamp: "2026-04-25T08:20",
};

describe("exceeds429Threshold", () => {
  it("returns false when 429 count is 0", () => {
    expect(exceeds429Threshold({ ...BASE, requests_429: 0 })).toBe(false);
  });

  it("returns false when rate is exactly 1% (boundary — not strictly greater)", () => {
    expect(
      exceeds429Threshold({ ...BASE, requests_429: 10, total_requests: 1000 }),
    ).toBe(false);
  });

  it("returns true when rate is just over 1%", () => {
    expect(
      exceeds429Threshold({ ...BASE, requests_429: 11, total_requests: 1000 }),
    ).toBe(true);
  });

  it("returns true when rate is well above 1%", () => {
    expect(
      exceeds429Threshold({ ...BASE, requests_429: 50, total_requests: 100 }),
    ).toBe(true);
  });

  it("returns false when total_requests is 0 (avoids division by zero)", () => {
    expect(
      exceeds429Threshold({ ...BASE, total_requests: 0, requests_429: 0 }),
    ).toBe(false);
  });

  it("returns false when total_requests is 0 even with non-zero 429 count", () => {
    expect(
      exceeds429Threshold({ ...BASE, total_requests: 0, requests_429: 5 }),
    ).toBe(false);
  });

  it("handles small window — 2/10 is 20%, well above 1%", () => {
    expect(
      exceeds429Threshold({ ...BASE, requests_429: 2, total_requests: 10 }),
    ).toBe(true);
  });

  it("handles small window — 0/10 is 0%, below threshold", () => {
    expect(
      exceeds429Threshold({ ...BASE, requests_429: 0, total_requests: 10 }),
    ).toBe(false);
  });
});
