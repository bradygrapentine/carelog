import { z } from "zod";

/** Validates the payload for scheduling a shift, including optional weekly recurrence (up to 12 weeks); enforces end_at > start_at. */
export const shiftCreateInput = z
  .object({
    org_id: z.string().uuid(),
    recipient_id: z.string().uuid(),
    assignee_user_id: z.string().uuid(),
    start_at: z.string().datetime(),
    end_at: z.string().datetime(),
    notes: z.string().max(2000).optional(),
    recurrence: z
      .object({
        freq: z.literal("weekly"),
        weeks: z.number().int().min(1).max(12),
      })
      .optional(),
  })
  .refine((d) => new Date(d.end_at) > new Date(d.start_at), {
    message: "end_at must be after start_at",
    path: ["end_at"],
  });

/** Validates a partial shift update (status, notes, reassignment); strict mode rejects unrecognised keys like recipient_id. */
export const shiftUpdateInput = z
  .object({
    id: z.string().uuid(),
    org_id: z.string().uuid(),
    status: z
      .enum(["scheduled", "in_progress", "completed", "cancelled"])
      .optional(),
    notes: z.string().max(2000).optional(),
    assignee_user_id: z.string().uuid().optional(),
  })
  .strict(); // reject extra keys like recipient_id

/** Validates paginated shift list query params; `cursor` is a row-offset integer and `limit` defaults to 50. */
export const shiftListInput = z.object({
  org_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  cursor: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).default(50),
});
