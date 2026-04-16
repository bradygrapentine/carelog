import { z } from "zod";

export const createTradeRequestInput = z.object({
  shiftId: z.string().uuid(),
  targetUserId: z.string().uuid().optional(),
  message: z.string().max(500).optional(),
});

export const respondTradeRequestInput = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["accept", "decline"]),
});

export const forceOverrideTradeInput = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["accept", "decline", "cancel"]),
});

export const listTradeRequestsInput = z.object({
  shiftId: z.string().uuid().optional(),
  status: z
    .array(z.enum(["open", "accepted", "declined", "expired", "cancelled"]))
    .optional(),
});

export type ShiftTradeRequest = {
  id: string;
  shiftId: string;
  orgId: string;
  requestedBy: string;
  targetUserId: string | null;
  status: "open" | "accepted" | "declined" | "expired" | "cancelled";
  message: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  expiresAt: string;
};

export type CreateTradeRequestInput = z.infer<typeof createTradeRequestInput>;
export type RespondTradeRequestInput = z.infer<typeof respondTradeRequestInput>;
export type ForceOverrideTradeInput = z.infer<typeof forceOverrideTradeInput>;
export type ListTradeRequestsInput = z.infer<typeof listTradeRequestsInput>;
