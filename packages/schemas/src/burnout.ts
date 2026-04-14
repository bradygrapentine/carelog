import { z } from "zod";

/** Validates the weekly caregiver well-being check-in (sleep/stress/support scores 1–5 plus an optional notes field). */
export const burnoutCheckInInput = z.object({
  org_id: z.string().uuid(),
  user_id: z.string().uuid(),
  sleep_score: z.number().int().min(1).max(5),
  stress_score: z.number().int().min(1).max(5),
  support_score: z.number().int().min(1).max(5),
  notes: z.string().max(500).optional(),
  week_stamp: z.string().regex(/^\d{4}-W\d{2}$/),
});

/** Validates the input for listing burnout check-ins scoped to an org. */
export const burnoutListInput = z.object({
  org_id: z.string().uuid(),
});
