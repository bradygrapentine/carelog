import { z } from "zod";

export const createInviteSchema = z.object({
  orgId: z.string().uuid(),
  recipientId: z.string().uuid().nullable(),
  role: z.enum(["coordinator", "caregiver", "supporter", "aide"]),
  email: z.string().email().max(254),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(64).max(64),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
