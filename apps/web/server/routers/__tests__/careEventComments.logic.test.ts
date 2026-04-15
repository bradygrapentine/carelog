import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../repositories/careEventCommentsRepository", () => ({
  listComments: vi.fn(),
  insertComment: vi.fn(),
  editComment: vi.fn(),
  softDeleteComment: vi.fn(),
  getEventOrgId: vi.fn(),
}));

vi.mock("../../../inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}));

import * as repo from "../../repositories/careEventCommentsRepository";
import { inngest } from "../../../inngest/client";
import { careEventCommentsRouter } from "../careEventComments";

const ctx = {
  user: { id: "user-1" },
  supabase: {} as any,
};

describe("careEventComments router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list returns non-deleted comments", async () => {
    (repo.listComments as any).mockResolvedValue([
      {
        id: "c1",
        authorId: "user-1",
        authorName: "A",
        body: "hi",
        editedAt: null,
        createdAt: "t",
      },
    ]);
    const caller = careEventCommentsRouter.createCaller(ctx as any);
    const out = await caller.list({
      careEventId: "11111111-1111-1111-1111-111111111111",
    });
    expect(out).toHaveLength(1);
    expect(out[0].body).toBe("hi");
  });

  it("add inserts and publishes inngest event", async () => {
    (repo.getEventOrgId as any).mockResolvedValue("org-1");
    (repo.insertComment as any).mockResolvedValue({
      id: "c1",
      createdAt: "2026-01-01T00:00:00Z",
    });
    const caller = careEventCommentsRouter.createCaller(ctx as any);
    const out = await caller.add({
      careEventId: "11111111-1111-1111-1111-111111111111",
      body: "hello",
    });
    expect(out).toEqual({ id: "c1", createdAt: "2026-01-01T00:00:00Z" });
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "careEventComment/created",
        data: expect.objectContaining({
          commentId: "c1",
          careEventId: "11111111-1111-1111-1111-111111111111",
          orgId: "org-1",
          authorId: "user-1",
        }),
      }),
    );
  });

  it("edit calls repo and returns editedAt", async () => {
    (repo.editComment as any).mockResolvedValue({
      editedAt: "2026-01-02T00:00:00Z",
    });
    const caller = careEventCommentsRouter.createCaller(ctx as any);
    const out = await caller.edit({
      commentId: "22222222-2222-2222-2222-222222222222",
      body: "updated",
    });
    expect(out.editedAt).toBe("2026-01-02T00:00:00Z");
  });

  it("remove soft-deletes", async () => {
    (repo.softDeleteComment as any).mockResolvedValue(undefined);
    const caller = careEventCommentsRouter.createCaller(ctx as any);
    const out = await caller.remove({
      commentId: "22222222-2222-2222-2222-222222222222",
    });
    expect(out).toEqual({ ok: true });
    expect(repo.softDeleteComment).toHaveBeenCalledWith(
      ctx.supabase,
      "22222222-2222-2222-2222-222222222222",
    );
  });

  it("add rejects empty body (Zod trim+min)", async () => {
    const caller = careEventCommentsRouter.createCaller(ctx as any);
    await expect(
      caller.add({
        careEventId: "11111111-1111-1111-1111-111111111111",
        body: "   ",
      }),
    ).rejects.toThrow();
  });
});
