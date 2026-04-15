// packages/schemas/src/careEventComments.ts
import { z } from "zod";

const uuid = z.string().uuid();
const body = z.string().trim().min(1).max(4000);

export const listCommentsInputSchema = z.object({
  careEventId: uuid,
});

export const addCommentInputSchema = z.object({
  careEventId: uuid,
  body,
});

export const editCommentInputSchema = z.object({
  commentId: uuid,
  body,
});

export const removeCommentInputSchema = z.object({
  commentId: uuid,
});

export type CareEventComment = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  editedAt: string | null;
  createdAt: string;
};
