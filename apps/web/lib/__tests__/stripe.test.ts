import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type Stripe from "stripe";

describe("getStripe singleton", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    // Reset the module state before each test so the singleton is fresh
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("throws a clear error when STRIPE_SECRET_KEY is missing", async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const { getStripe } = await import("../stripe");

    expect(() => getStripe()).toThrow("STRIPE_SECRET_KEY is not set");
  });

  it("returns the same Stripe instance across multiple calls (singleton)", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_testing";

    const { getStripe } = await import("../stripe");

    const instance1 = getStripe();
    const instance2 = getStripe();

    expect(instance1).toBe(instance2);
  });

  it("initializes Stripe with the pinned API version 2026-03-25.dahlia", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_testing";

    // Mock the Stripe constructor to spy on its arguments
    const stripeMock = vi.fn(function (this: any, key: string, options: any) {
      this.apiVersion = options.apiVersion;
    });

    vi.doMock("stripe", () => ({
      default: stripeMock,
    }));

    const { getStripe } = await import("../stripe");
    getStripe();

    expect(stripeMock).toHaveBeenCalledWith(
      "sk_test_fake_key_for_testing",
      expect.objectContaining({
        apiVersion: "2026-03-25.dahlia",
      }),
    );
  });
});
