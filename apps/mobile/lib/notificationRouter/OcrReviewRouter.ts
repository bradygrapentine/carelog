import type { Router } from "expo-router";
import type { NotificationPayload } from "./types";
import type { NotificationRouter } from "./index";

export const ocrReviewRouter: NotificationRouter = {
  canHandle(payload: NotificationPayload): boolean {
    return payload.screen === "ocr-review" && payload.jobId !== undefined;
  },

  handle(payload: NotificationPayload, router: Router): void {
    // Byte-identical to original: router.push("/(app)/documents/ocr-review/" + data.jobId)
    router.push("/(app)/documents/ocr-review/" + payload.jobId!);
  },
};
