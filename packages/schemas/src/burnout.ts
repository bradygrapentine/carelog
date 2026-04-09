import { z } from "zod";

export const burnoutCheckInInput = z.object({
  org_id:        z.string().uuid(),
  user_id:       z.string().uuid(),
  sleep_score:   z.number().int().min(1).max(5),
  stress_score:  z.number().int().min(1).max(5),
  support_score: z.number().int().min(1).max(5),
  notes:         z.string().max(500).optional(),
  week_stamp:    z.string().regex(/^\d{4}-W\d{2}$/),
});

export const burnoutListInput = z.object({
  org_id: z.string().uuid(),
});
