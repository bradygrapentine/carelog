import { describe, it, expect, vi } from "vitest";
import { NotificationPayloadSchema } from "../notificationRouter/types";
import { dispatchNotification } from "../notificationRouter";
import { ocrReviewRouter } from "../notificationRouter/OcrReviewRouter";
import type { Router } from "expo-router";

const mockRouter = { push: vi.fn() } as unknown as Router;

describe("NotificationPayloadSchema", () => {
  it("parses valid ocr-review payload", () => {
    const result = NotificationPayloadSchema.safeParse({
      screen: "ocr-review",
      jobId: "abc123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.screen).toBe("ocr-review");
      expect(result.data.jobId).toBe("abc123");
    }
  });

  it("parses payload without optional jobId", () => {
    const result = NotificationPayloadSchema.safeParse({ screen: "other" });
    expect(result.success).toBe(true);
  });

  it("fails when screen is missing", () => {
    const result = NotificationPayloadSchema.safeParse({ jobId: "abc" });
    expect(result.success).toBe(false);
  });
});

describe("OcrReviewRouter", () => {
  it("canHandle returns true for ocr-review with jobId", () => {
    expect(
      ocrReviewRouter.canHandle({ screen: "ocr-review", jobId: "job1" }),
    ).toBe(true);
  });

  it("canHandle returns false when screen is ocr-review but jobId missing", () => {
    expect(ocrReviewRouter.canHandle({ screen: "ocr-review" })).toBe(false);
  });

  it("canHandle returns false for unknown screen", () => {
    expect(
      ocrReviewRouter.canHandle({ screen: "other-screen", jobId: "job1" }),
    ).toBe(false);
  });

  it("handle pushes the correct route — byte-identical to original", () => {
    const router = { push: vi.fn() } as unknown as Router;
    ocrReviewRouter.handle({ screen: "ocr-review", jobId: "job42" }, router);
    expect(router.push).toHaveBeenCalledWith(
      "/(app)/documents/ocr-review/job42",
    );
  });
});

describe("dispatchNotification", () => {
  it("routes ocr-review payload to ocrReviewRouter", () => {
    const router = { push: vi.fn() } as unknown as Router;
    dispatchNotification(
      { screen: "ocr-review", jobId: "job99" },
      [ocrReviewRouter],
      router,
    );
    expect(router.push).toHaveBeenCalledWith(
      "/(app)/documents/ocr-review/job99",
    );
  });

  it("unknown screen is no-op — router.push never called", () => {
    const router = { push: vi.fn() } as unknown as Router;
    dispatchNotification(
      { screen: "some-unknown-screen" },
      [ocrReviewRouter],
      router,
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it("calls only the first matching router and stops", () => {
    const router = { push: vi.fn() } as unknown as Router;
    const secondRouter = { canHandle: vi.fn(() => true), handle: vi.fn() };
    dispatchNotification(
      { screen: "ocr-review", jobId: "j1" },
      [ocrReviewRouter, secondRouter],
      router,
    );
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(secondRouter.handle).not.toHaveBeenCalled();
  });
});

// Suppress unused-import warning
void mockRouter;
