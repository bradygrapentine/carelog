import { z } from "zod";

/** Validates the payload for sending a membership invite; email must be ≤254 chars per RFC 5321. */
export const createInviteSchema = z.object({
  orgId: z.string().uuid(),
  recipientId: z.string().uuid().nullable(),
  role: z.enum(["coordinator", "caregiver", "supporter", "aide"]),
  email: z.string().email().max(254),
});

/** Validates the 64-character hex token submitted when a user accepts an invite link. */
export const acceptInviteSchema = z.object({
  token: z.string().min(64).max(64),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
