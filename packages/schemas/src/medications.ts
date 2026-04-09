import { z } from "zod";

export const medicationCreateInput = z.object({
  org_id:               z.string().uuid(),
  recipient_id:         z.string().uuid(),
  drug_name:            z.string().min(1).max(200),
  brand_name:           z.string().max(200).optional(),
  dosage:               z.string().min(1).max(100),
  form:                 z.string().max(100).optional(),
  instructions:         z.string().max(1000).optional(),
  prescriber:           z.string().max(200).optional(),
  pharmacy:             z.string().max(200).optional(),
  pharmacy_phone:       z.string().max(30).optional(),
  refills_remaining:    z.number().int().min(0).optional(),
  supply_days_remaining: z.number().int().min(0).optional(),
  last_refill_date:     z.string().optional(), // YYYY-MM-DD
});

export const medicationListInput = z.object({
  org_id:       z.string().uuid(),
  recipient_id: z.string().uuid(),
});

export const medicationUpdateInput = z.object({
  id:                   z.string().uuid(),
  org_id:               z.string().uuid(),
  supply_days_remaining: z.number().int().min(0).optional(),
  refills_remaining:    z.number().int().min(0).optional(),
  active:               z.boolean().optional(),
});
