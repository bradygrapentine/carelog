import { z } from "zod";

/** Validates the payload for creating a new organization (family, agency, institution, or employer). */
export const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  org_type: z.enum(["family", "agency", "institution", "employer"]),
});

/** Partial version of `createOrgSchema`; all fields optional for PATCH-style updates. */
export const updateOrgSchema = createOrgSchema.partial();

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
