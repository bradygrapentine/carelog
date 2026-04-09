import { z } from "zod";

export const shiftCreateInput = z
  .object({
    org_id:           z.string().uuid(),
    recipient_id:     z.string().uuid(),
    assignee_user_id: z.string().uuid(),
    start_at:         z.string().datetime(),
    end_at:           z.string().datetime(),
    notes:            z.string().max(2000).optional(),
  })
  .refine((d) => new Date(d.end_at) > new Date(d.start_at), {
    message: "end_at must be after start_at",
    path: ["end_at"],
  });

export const shiftUpdateInput = z
  .object({
    id:               z.string().uuid(),
    org_id:           z.string().uuid(),
    status:           z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
    notes:            z.string().max(2000).optional(),
    assignee_user_id: z.string().uuid().optional(),
  })
  .strict(); // reject extra keys like recipient_id

export const shiftListInput = z.object({
  org_id:       z.string().uuid(),
  recipient_id: z.string().uuid(),
  from:         z.string().datetime(),
  to:           z.string().datetime(),
  cursor:       z.number().int().nonnegative().optional(),
  limit:        z.number().int().positive().max(200).default(50),
});
