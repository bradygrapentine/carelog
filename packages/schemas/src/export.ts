import { z } from "zod";

/** Validates a request to export a recipient's care data in JSON or PDF format, with an optional start date. */
export const exportRequestSchema = z.object({
  orgId: z.string().uuid(),
  recipientId: z.string().uuid(),
  format: z.enum(["json", "pdf"]),
  since: z.string().datetime({ offset: true }).optional(),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;
