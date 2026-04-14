import { z } from "zod";

/** Validates the payload for creating a community help request (meal, transport, errand, etc.) with optional slot count and deadline. */
export const outerCircleRequestCreateInput = z.object({
  org_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  request_type: z.enum(["meal", "transport", "errand", "visit", "other"]),
  slots_total: z.number().int().min(1).max(20).default(1),
  needed_by: z.string().datetime().optional(),
});

/** Validates the identifiers needed to deactivate (soft-delete) a community help request, scoped to the org. */
export const outerCircleDeactivateInput = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
});

/** Validates the query parameters for listing active community help requests for a recipient. */
export const outerCircleListInput = z.object({
  org_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
});

export type OuterCircleRequestCreateInput = z.infer<
  typeof outerCircleRequestCreateInput
>;
export type OuterCircleDeactivateInput = z.infer<
  typeof outerCircleDeactivateInput
>;
export type OuterCircleListInput = z.infer<typeof outerCircleListInput>;
