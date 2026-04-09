import { z } from "zod";

const hhMm = z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format (e.g. 09:00)");

export const coverageWindowCreateInput = z
  .object({
    org_id:        z.string().uuid(),
    recipient_id:  z.string().uuid(),
    label:         z.string().min(1).max(200),
    starts_at:     hhMm,
    ends_at:       hhMm,
    required_role: z.enum(["caregiver", "coordinator", "aide"]).optional(),
    day_of_week:   z.number().int().min(0).max(6), // 0=Sunday, 6=Saturday
    recurring:     z.literal(true).default(true),
  })
  .refine(
    (d) => {
      const toMin = (t: string) => parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(3, 5));
      return toMin(d.ends_at) > toMin(d.starts_at);
    },
    { message: "ends_at must be after starts_at", path: ["ends_at"] }
  );

export const coverageWindowListInput = z.object({
  org_id:       z.string().uuid(),
  recipient_id: z.string().uuid(),
});
