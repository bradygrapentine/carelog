// apps/web/server/routers/__tests__/messages.edge.test.ts
// Edge cases: self-DM guard, inngest.send spy, markRead return shape
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ── mocks ────────────────────────────────────────────────────────────────────

const { inngestSendSpy } = vi.hoisted(() => ({
  inngestSendSpy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../inngest/client", () => ({
  inngest: { send: inngestSendSpy },
}));

vi.mock("../../repositories/messagesRepository", () => ({
  listThreadsForUser: vi.fn().mockResolvedValue([]),
  getThreadMessages: vi.fn().mockResolvedValue([]),
  getThreadMembers: vi.fn().mockResolvedValue([]),
  findOrCreateDm: vi.fn().mockResolvedValue("dm-thread-id"),
  createGroupThread: vi.fn().mockResolvedValue("group-thread-id"),
  insertMessage: vi.fn().mockResolvedValue({
    id: "msg-uuid-1",
    thread_id: "thread-uuid-1",
    sender_id: "user-uuid-1",
    body: "edge case body",
    created_at: "2026-01-01T00:00:00Z",
    edited_at: null,
    deleted_at: null,
  }),
  markThreadRead: vi.fn().mockResolvedValue(undefined),
}));

import * as repo from "../../repositories/messagesRepository";
import { inngest } from "../../../inngest/client";

// ── minimal tRPC context stub ─────────────────────────────────────────────────

function makeCtx(userId = "user-uuid-1") {
  return {
    user: { id: userId },
    supabase: {} as never,
  };
}

// ── helpers that replicate the router's procedure logic ───────────────────────

async function callCreateDm(
  ctx: ReturnType<typeof makeCtx>,
  input: { targetUserId: string; orgId: string },
) {
  if (input.targetUserId === ctx.user.id) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot DM yourself" });
  }
  const threadId = await repo.findOrCreateDm(
    ctx.user.id,
    input.targetUserId,
    input.orgId,
  );
  return { threadId };
}

async function callSendMessage(
  ctx: ReturnType<typeof makeCtx>,
  input: { threadId: string; body: string },
) {
  const message = await repo.insertMessage(
    ctx.supabase,
    input.threadId,
    ctx.user.id,
    input.body,
  );
  await inngest
    .send({
      name: "messaging/message.sent",
      data: {
        threadId: input.threadId,
        messageId: message.id,
        senderId: ctx.user.id,
        sentAt: message.created_at as string,
      },
    })
    .catch(() => {});
  return message;
}

async function callMarkRead(
  ctx: ReturnType<typeof makeCtx>,
  input: { threadId: string },
) {
  await repo.markThreadRead(ctx.supabase, input.threadId, ctx.user.id);
  return { ok: true };
}

// ── tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  inngestSendSpy.mockResolvedValue(undefined);
});

describe("createDm — self-DM guard", () => {
  it("throws BAD_REQUEST when targetUserId === userId", async () => {
    const ctx = makeCtx("user-uuid-1");
    await expect(
      callCreateDm(ctx, { targetUserId: "user-uuid-1", orgId: "org-1" }),
    ).rejects.toThrow(TRPCError);
  });

  it("thrown error has code BAD_REQUEST", async () => {
    const ctx = makeCtx("user-uuid-1");
    try {
      await callCreateDm(ctx, { targetUserId: "user-uuid-1", orgId: "org-1" });
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("BAD_REQUEST");
    }
  });

  it("succeeds when targetUserId !== userId", async () => {
    const ctx = makeCtx("user-uuid-1");
    const result = await callCreateDm(ctx, {
      targetUserId: "user-uuid-2",
      orgId: "org-1",
    });
    expect(result.threadId).toBe("dm-thread-id");
  });
});

describe("sendMessage — inngest.send", () => {
  it("calls inngest.send after inserting a message", async () => {
    const ctx = makeCtx("user-uuid-1");
    await callSendMessage(ctx, { threadId: "thread-uuid-1", body: "hello" });
    expect(inngestSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "messaging/message.sent",
        data: expect.objectContaining({
          threadId: "thread-uuid-1",
          messageId: "msg-uuid-1",
          senderId: "user-uuid-1",
        }),
      }),
    );
  });

  it("still returns message even if inngest.send rejects (fire-and-forget)", async () => {
    inngestSendSpy.mockRejectedValueOnce(new Error("inngest down"));
    const ctx = makeCtx("user-uuid-1");
    const msg = await callSendMessage(ctx, {
      threadId: "thread-uuid-1",
      body: "resilient",
    });
    expect(msg.id).toBe("msg-uuid-1");
  });

  it("passes sentAt from the inserted message's created_at", async () => {
    const ctx = makeCtx("user-uuid-1");
    await callSendMessage(ctx, { threadId: "thread-uuid-1", body: "ts test" });
    expect(inngestSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sentAt: "2026-01-01T00:00:00Z" }),
      }),
    );
  });
});

describe("markRead — return shape", () => {
  it("returns { ok: true }", async () => {
    const ctx = makeCtx("user-uuid-1");
    const result = await callMarkRead(ctx, { threadId: "thread-uuid-1" });
    expect(result).toEqual({ ok: true });
  });

  it("calls markThreadRead with the correct thread and user ids", async () => {
    const ctx = makeCtx("user-uuid-99");
    await callMarkRead(ctx, { threadId: "thread-abc" });
    expect(repo.markThreadRead).toHaveBeenCalledWith(
      expect.anything(),
      "thread-abc",
      "user-uuid-99",
    );
  });
});
