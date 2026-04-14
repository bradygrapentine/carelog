import { z } from "zod";

/** Validates the upsert payload for a recipient's end-of-life plan (proxy, resuscitation preference, funeral preference, etc.). */
export const eolPlanUpsertInput = z.object({
  org_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  healthcare_proxy: z.string().optional(),
  resuscitation_pref: z.enum(["full", "dnr", "dnr_comfort_only"]).optional(),
  funeral_pref: z.string().optional(),
  legacy_message: z.string().optional(),
  attorney_name: z.string().optional(),
  attorney_contact: z.string().optional(),
});
