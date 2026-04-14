// packages/schemas/src/messages.ts
import { z } from "zod";

export const threadTypeSchema = z.enum(["dm", "group"]);

export const messageSchema = z.object({
  id: z.string().uuid(),
  thread_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  body: z.string().min(1).max(4000),
  created_at: z.string().datetime(),
  edited_at: z.string().datetime().nullable(),
  deleted_at: z.string().datetime().nullable(),
});

export const threadMemberSchema = z.object({
  thread_id: z.string().uuid(),
  user_id: z.string().uuid(),
  last_read_at: z.string().datetime().nullable(),
  joined_at: z.string().datetime(),
  // joined via query — display name from user_profiles
  display_name: z.string().nullable().optional(),
});

export const messageThreadSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  thread_type: threadTypeSchema,
  name: z.string().nullable(),
  created_by: z.string().uuid(),
  created_at: z.string().datetime(),
  // computed fields from queries
  last_message_body: z.string().nullable().optional(),
  last_message_at: z.string().datetime().nullable().optional(),
  unread_count: z.number().int().min(0).optional(),
  members: z.array(threadMemberSchema).optional(),
});

export const sendMessageInputSchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().min(1).max(4000).trim(),
});

export const createDmInputSchema = z.object({
  orgId: z.string().uuid(),
  targetUserId: z.string().uuid(),
});

export const createGroupInputSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1).max(80).trim(),
  memberUserIds: z.array(z.string().uuid()).min(1).max(49),
});

export const markReadInputSchema = z.object({
  threadId: z.string().uuid(),
});

export type MessageThread = z.infer<typeof messageThreadSchema>;
export type Message = z.infer<typeof messageSchema>;
export type ThreadMember = z.infer<typeof threadMemberSchema>;
