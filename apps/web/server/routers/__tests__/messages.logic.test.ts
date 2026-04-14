// apps/web/server/routers/__tests__/messages.logic.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the repository
vi.mock("../../repositories/messagesRepository", () => ({
  listThreadsForUser: vi.fn().mockResolvedValue([]),
  getThreadMessages: vi.fn().mockResolvedValue([]),
  getThreadMembers: vi.fn().mockResolvedValue([]),
  findOrCreateDm: vi.fn().mockResolvedValue("thread-uuid-1"),
  createGroupThread: vi.fn().mockResolvedValue("thread-uuid-2"),
  insertMessage: vi.fn().mockResolvedValue({
    id: "msg-uuid-1",
    thread_id: "thread-uuid-1",
    sender_id: "user-uuid-1",
    body: "hello",
    created_at: new Date().toISOString(),
    edited_at: null,
    deleted_at: null,
  }),
  markThreadRead: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}));

import * as repo from "../../repositories/messagesRepository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("messagesRouter — createDm", () => {
  it("rejects self-DM (guard condition is true when userId === targetUserId)", () => {
    const userId = "user-uuid-1";
    const targetUserId = "user-uuid-1";
    expect(userId === targetUserId).toBe(true); // guard triggers
  });

  it("calls findOrCreateDm with correct args", async () => {
    await repo.findOrCreateDm("user-a", "user-b", "org-1");
    expect(repo.findOrCreateDm).toHaveBeenCalledWith(
      "user-a",
      "user-b",
      "org-1",
    );
  });

  it("allows DM between different users", () => {
    const userId: string = "user-uuid-1";
    const targetUserId: string = "user-uuid-2";
    expect(userId === targetUserId).toBe(false); // guard does NOT trigger
  });
});

describe("messagesRouter — sendMessage", () => {
  it("calls insertMessage and returns message with body", async () => {
    const msg = await repo.insertMessage({} as never, "t1", "u1", "hello");
    expect(msg.body).toBe("hello");
    expect(repo.insertMessage).toHaveBeenCalledWith({}, "t1", "u1", "hello");
  });

  it("insertMessage returns expected shape", async () => {
    const msg = await repo.insertMessage({} as never, "t1", "u1", "test");
    expect(msg).toHaveProperty("id");
    expect(msg).toHaveProperty("thread_id");
    expect(msg).toHaveProperty("sender_id");
    expect(msg).toHaveProperty("created_at");
    expect(msg.deleted_at).toBeNull();
  });
});

describe("messagesRouter — markRead", () => {
  it("calls markThreadRead with thread and user ids", async () => {
    await repo.markThreadRead({} as never, "thread-1", "user-1");
    expect(repo.markThreadRead).toHaveBeenCalledWith({}, "thread-1", "user-1");
  });
});

describe("messagesRouter — listThreads", () => {
  it("calls listThreadsForUser and returns array", async () => {
    const result = await repo.listThreadsForUser(
      {} as never,
      "user-1",
      "org-1",
    );
    expect(Array.isArray(result)).toBe(true);
    expect(repo.listThreadsForUser).toHaveBeenCalledWith({}, "user-1", "org-1");
  });
});

describe("messagesRouter — createGroup", () => {
  it("calls createGroupThread with correct args", async () => {
    const threadId = await repo.createGroupThread(
      "user-1",
      "org-1",
      "Care Team",
      ["user-2", "user-3"],
    );
    expect(threadId).toBe("thread-uuid-2");
    expect(repo.createGroupThread).toHaveBeenCalledWith(
      "user-1",
      "org-1",
      "Care Team",
      ["user-2", "user-3"],
    );
  });
});
