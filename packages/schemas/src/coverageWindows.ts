import { z } from "zod";

export const coverageWindowCreateInput = z
  .object({
    org_id:        z.string().uuid(),
    recipient_id:  z.string().uuid(),
    label:         z.string().min(1).max(200),
    starts_at:     z.string(), // HH:MM format for recurring, or full datetime
    ends_at:       z.string(),
    required_role: z.enum(["caregiver", "coordinator", "aide"]).optional(),
    day_of_week:   z.number().int().min(0).max(6), // 0=Sunday, 6=Saturday
    recurring:     z.literal(true).default(true),
  })
  .refine((d) => d.ends_at > d.starts_at, {
    message: "ends_at must be after starts_at",
    path: ["ends_at"],
  });

export const coverageWindowListInput = z.object({
  org_id:       z.string().uuid(),
  recipient_id: z.string().uuid(),
});
