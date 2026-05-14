import type { Router } from "expo-router";
import { NotificationPayloadSchema, type NotificationPayload } from "./types";

export { NotificationPayloadSchema };
export type { NotificationPayload };

export type NotificationRouter = {
  canHandle(payload: NotificationPayload): boolean;
  handle(payload: NotificationPayload, router: Router): void;
};

/**
 * Dispatch a notification payload to the first router that can handle it.
 * Unknown screens are a no-op (preserves existing behavior).
 */
export function dispatchNotification(
  payload: NotificationPayload,
  routers: NotificationRouter[],
  router: Router,
): void {
  for (const r of routers) {
    if (r.canHandle(payload)) {
      r.handle(payload, router);
      return;
    }
  }
}
