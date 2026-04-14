import { z } from "zod";

const EXPENSE_CATEGORIES = [
  "medication",
  "supplies",
  "equipment",
  "home_modification",
  "aide_hours",
  "transport",
  "food",
  "other",
] as const;

/** Validates the payload for creating a new care-related expense record. */
export const expenseCreateInput = z.object({
  org_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().min(1),
  paid_by_name: z.string().optional(),
  incurred_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/** Validates query parameters for listing expenses, with an optional `since` date filter (YYYY-MM-DD). */
export const expenseListInput = z.object({
  org_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  since: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/** Validates the minimum identifiers required to delete an expense (guards against cross-org deletions). */
export const expenseDeleteInput = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
});
