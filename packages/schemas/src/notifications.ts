import { z } from "zod";

// ON-81: task-notification wire shapes. The DB is the source of truth
// (notification_preferences task columns + in_app_notifications feed table);
// these mirror them for the tRPC notifications router. Per code style:
// string-literal unions, no enum.

export const taskNotificationTypes = [
  "task_assigned",
  "task_completed",
  "task_created",
] as const;
export const taskNotificationType = z.enum(taskNotificationTypes);
export type TaskNotificationType = z.infer<typeof taskNotificationType>;

// Per-user task-notification preferences (a subset of notification_preferences).
// Coordinator/owner sets only their OWN row — the router scopes to ctx.user.
export const taskNotificationPrefsPayload = z.object({
  task_assigned: z.boolean(),
  task_completed: z.boolean(),
  task_created: z.boolean(),
});
export type TaskNotificationPrefsPayload = z.infer<
  typeof taskNotificationPrefsPayload
>;

// An in-app feed row as surfaced to the client (RLS guarantees own-rows-only).
export const inAppNotification = z.object({
  id: z.string().uuid(),
  type: taskNotificationType,
  task_id: z.string().uuid().nullable(),
  title: z.string().nullable(),
  body: z.string().nullable(),
  read_at: z.string().nullable(),
  created_at: z.string(),
});
export type InAppNotification = z.infer<typeof inAppNotification>;

// The Inngest task-notification event payload (UUID-only — never task content,
// per ADR-0001 PHI rule). Emitted from tasks.ts create/assign/complete/update.
export const taskNotificationEvent = z.object({
  type: taskNotificationType,
  taskId: z.string().uuid(),
  orgId: z.string().uuid(),
  recipientId: z.string().uuid(),
  actorId: z.string().uuid(),
});
export type TaskNotificationEvent = z.infer<typeof taskNotificationEvent>;
