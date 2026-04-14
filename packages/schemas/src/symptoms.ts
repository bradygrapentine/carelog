import { z } from "zod";

/** Validates a symptom observation entry; all clinical fields (pain, mood, appetite, mobility) are optional to allow partial logging. */
export const symptomLogInput = z.object({
  org_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  pain_level: z.number().int().min(0).max(10).optional(),
  mood: z.enum(["good", "okay", "difficult", "crisis"]).optional(),
  appetite: z.enum(["normal", "reduced", "poor", "none"]).optional(),
  mobility: z.enum(["normal", "limited", "assisted", "bedbound"]).optional(),
  notes: z.string().max(1000).optional(),
});

/** Validates query parameters for fetching all symptom log entries for a recipient. */
export const symptomListInput = z.object({
  org_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
});
