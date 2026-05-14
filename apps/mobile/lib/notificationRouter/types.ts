import { z } from "zod";

export const NotificationPayloadSchema = z.object({
  screen: z.string(),
  jobId: z.string().optional(),
});

export type NotificationPayload = z.infer<typeof NotificationPayloadSchema>;
