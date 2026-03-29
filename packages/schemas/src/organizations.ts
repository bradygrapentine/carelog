import { z } from "zod";

export const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  org_type: z.enum(["family", "agency", "institution", "employer"]),
});

export const updateOrgSchema = createOrgSchema.partial();

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
