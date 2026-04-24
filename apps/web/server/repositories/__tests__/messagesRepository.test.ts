// apps/web/server/repositories/__tests__/messagesRepository.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabaseAdmin (used by findOrCreateDm, createGroupThread, getThreadMembersForPush)
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";

import {
  listThreadsForUser,
  getThreadMessages,
  getThreadMembers,
  insertMessage,
  markThreadRead,
  findOrCreateDm,
  createGroupThread,
  getThreadMembersForPush,
} from "../messagesRepository";

// ─── chain builder helpers ───────────────────────────────────────────────────

function makeQueryChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.is = () => chain;
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.lt = () => chain;
  chain.update = () => chain;
  chain.insert = () => chain;
  chain.single = vi.fn().mockResolvedValue(result);
  // Make the chain itself awaitable for queries that don't call .single()
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

function makeInsertChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.insert = () => chain;
  chain.select = () => chain;
  chain.single = vi.fn().mockResolvedValue(result);
  chain.eq = () => chain;
  chain.update = () => chain;
  // awaitable
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

// Minimal Supabase client stub passed as `client` arg
function makeClient(result: { data: unknown; error: unknown }) {
  const chain = makeQueryChain(result);
  return {
    from: vi.fn(() => chain),
  } as unknown as import("@supabase/supabase-js").SupabaseClient<
    import("@carelog/types").Database
  >;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  vi.mocked(supabaseAdmin.rpc).mockReset();
});

// ─── listThreadsForUser ───────────────────────────────────────────────────────

describe("listThreadsForUser", () => {
  it("returns threads array on success", async () => {
    const threads = [{ id: "t1", thread_type: "dm" }];
    const client = makeClient({ data: threads, error: null });
    const result = await listThreadsForUser(client, "user-1", "org-1");
    expect(result).toEqual(threads);
  });

  it("returns empty array when data is null", async () => {
    const client = makeClient({ data: null, error: null });
    const result = await listThreadsForUser(client, "user-1", "org-1");
    expect(result).toEqual([]);
  });

  it("throws when supabase returns an error", async () => {
    const client = makeClient({ data: null, error: new Error("db error") });
    await expect(listThreadsForUser(client, "user-1", "org-1")).rejects.toThrow(
      "db error",
    );
  });
});

// ─── getThreadMessages ────────────────────────────────────────────────────────

describe("getThreadMessages", () => {
  it("returns messages in chronological order (reversed)", async () => {
    // Supabase returns DESC order (newest first); repository reverses to chronological
    const desc = [
      { id: "m3", created_at: "2026-01-03" },
      { id: "m2", created_at: "2026-01-02" },
      { id: "m1", created_at: "2026-01-01" },
    ];
    const client = makeClient({ data: desc, error: null });
    const result = await getThreadMessages(client, "t1");
    expect(result[0]).toMatchObject({ id: "m1" });
    expect(result[2]).toMatchObject({ id: "m3" });
  });

  it("returns empty array when no messages", async () => {
    const client = makeClient({ data: [], error: null });
    const result = await getThreadMessages(client, "t1");
    expect(result).toEqual([]);
  });

  it("supports before cursor (passes lt filter)", async () => {
    const client = makeClient({ data: [{ id: "m1" }], error: null });
    const result = await getThreadMessages(
      client,
      "t1",
      10,
      "2026-01-05T00:00:00Z",
    );
    expect(result).toHaveLength(1);
  });

  it("throws on error", async () => {
    const client = makeClient({ data: null, error: new Error("fail") });
    await expect(getThreadMessages(client, "t1")).rejects.toThrow("fail");
  });
});

// ─── getThreadMembers ─────────────────────────────────────────────────────────

describe("getThreadMembers", () => {
  it("returns members array", async () => {
    const members = [{ user_id: "u1" }, { user_id: "u2" }];
    const client = makeClient({ data: members, error: null });
    const result = await getThreadMembers(client, "t1");
    expect(result).toEqual(members);
  });

  it("returns empty array when no members", async () => {
    const client = makeClient({ data: null, error: null });
    const result = await getThreadMembers(client, "t1");
    expect(result).toEqual([]);
  });

  it("throws on error", async () => {
    const client = makeClient({ data: null, error: new Error("db fail") });
    await expect(getThreadMembers(client, "t1")).rejects.toThrow("db fail");
  });
});

// ─── insertMessage ────────────────────────────────────────────────────────────

describe("insertMessage", () => {
  it("inserts and returns the message row", async () => {
    const msg = {
      id: "msg-1",
      thread_id: "t1",
      sender_id: "u1",
      body: "hello",
      created_at: "2026-01-01T00:00:00Z",
      edited_at: null,
      deleted_at: null,
    };
    const chain = makeInsertChain({ data: msg, error: null });
    const client = {
      from: vi.fn(() => chain),
    } as unknown as import("@supabase/supabase-js").SupabaseClient<
      import("@carelog/types").Database
    >;
    const result = await insertMessage(client, "t1", "u1", "hello");
    expect(result).toMatchObject({ id: "msg-1", body: "hello" });
  });

  it("throws on insert error", async () => {
    const chain = makeInsertChain({
      data: null,
      error: new Error("insert fail"),
    });
    const client = {
      from: vi.fn(() => chain),
    } as unknown as import("@supabase/supabase-js").SupabaseClient<
      import("@carelog/types").Database
    >;
    await expect(insertMessage(client, "t1", "u1", "hello")).rejects.toThrow(
      "insert fail",
    );
  });
});

// ─── markThreadRead ───────────────────────────────────────────────────────────

describe("markThreadRead", () => {
  it("calls update with thread_id and user_id filters", async () => {
    const chain = makeQueryChain({ data: null, error: null });
    const updateSpy = vi.fn(() => chain);
    (chain as Record<string, unknown>).update = updateSpy;
    const client = {
      from: vi.fn(() => chain),
    } as unknown as import("@supabase/supabase-js").SupabaseClient<
      import("@carelog/types").Database
    >;
    await markThreadRead(client, "t1", "u1");
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ last_read_at: expect.any(String) }),
    );
  });

  it("throws on error", async () => {
    const chain = makeQueryChain({
      data: null,
      error: new Error("update fail"),
    });
    const client = {
      from: vi.fn(() => chain),
    } as unknown as import("@supabase/supabase-js").SupabaseClient<
      import("@carelog/types").Database
    >;
    await expect(markThreadRead(client, "t1", "u1")).rejects.toThrow(
      "update fail",
    );
  });
});

// ─── findOrCreateDm ───────────────────────────────────────────────────────────

describe("findOrCreateDm", () => {
  it("returns existing thread ID when RPC returns one", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({
      data: "existing-thread-id",
      error: null,
      count: null,
      status: 200,
      statusText: "OK",
    } as unknown as Awaited<ReturnType<typeof supabaseAdmin.rpc>>);

    const result = await findOrCreateDm("user-a", "user-b", "org-1");
    expect(result).toBe("existing-thread-id");
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it("creates a new thread+members when RPC returns null", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({
      data: null,
      error: null,
      count: null,
      status: 200,
      statusText: "OK",
    } as unknown as Awaited<ReturnType<typeof supabaseAdmin.rpc>>);

    const newThread = { id: "new-thread-id" };
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: newThread, error: null }),
      from: vi.fn(),
    };
    const membersChain = {
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        insertChain as unknown as ReturnType<typeof supabaseAdmin.from>,
      )
      .mockReturnValueOnce(
        membersChain as unknown as ReturnType<typeof supabaseAdmin.from>,
      );

    const result = await findOrCreateDm("user-a", "user-b", "org-1");
    expect(result).toBe("new-thread-id");
    expect(membersChain.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ user_id: "user-a" }),
        expect.objectContaining({ user_id: "user-b" }),
      ]),
    );
  });

  it("throws when thread creation fails", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({
      data: null,
      error: null,
      count: null,
      status: 200,
      statusText: "OK",
    } as unknown as Awaited<ReturnType<typeof supabaseAdmin.rpc>>);

    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({ data: null, error: new Error("create fail") }),
    };
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      insertChain as unknown as ReturnType<typeof supabaseAdmin.from>,
    );

    await expect(findOrCreateDm("user-a", "user-b", "org-1")).rejects.toThrow(
      "create fail",
    );
  });
});

// ─── createGroupThread ────────────────────────────────────────────────────────

describe("createGroupThread", () => {
  it("creates thread and inserts all members (creator deduped)", async () => {
    const thread = { id: "group-thread-id" };
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: thread, error: null }),
    };
    const membersChain = {
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        insertChain as unknown as ReturnType<typeof supabaseAdmin.from>,
      )
      .mockReturnValueOnce(
        membersChain as unknown as ReturnType<typeof supabaseAdmin.from>,
      );

    const result = await createGroupThread("user-1", "org-1", "Care Team", [
      "user-2",
      "user-3",
    ]);
    expect(result).toBe("group-thread-id");
    expect(membersChain.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ user_id: "user-1" }),
        expect.objectContaining({ user_id: "user-2" }),
        expect.objectContaining({ user_id: "user-3" }),
      ]),
    );
    // deduplicated — creator appears only once
    const callArg = vi.mocked(membersChain.insert).mock.calls[0][0] as Array<{
      user_id: string;
    }>;
    expect(callArg.filter((m) => m.user_id === "user-1")).toHaveLength(1);
  });

  it("deduplicates creator when they appear in memberUserIds", async () => {
    const thread = { id: "group-thread-2" };
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: thread, error: null }),
    };
    const membersChain = {
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        insertChain as unknown as ReturnType<typeof supabaseAdmin.from>,
      )
      .mockReturnValueOnce(
        membersChain as unknown as ReturnType<typeof supabaseAdmin.from>,
      );

    await createGroupThread("user-1", "org-1", "Dupe Test", [
      "user-1",
      "user-2",
    ]);
    const callArg = vi.mocked(membersChain.insert).mock.calls[0][0] as Array<{
      user_id: string;
    }>;
    expect(callArg.filter((m) => m.user_id === "user-1")).toHaveLength(1);
  });

  it("throws when thread creation fails", async () => {
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({ data: null, error: new Error("group fail") }),
    };
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      insertChain as unknown as ReturnType<typeof supabaseAdmin.from>,
    );
    await expect(
      createGroupThread("user-1", "org-1", "Fail Group", ["user-2"]),
    ).rejects.toThrow("group fail");
  });
});

// ─── getThreadMembersForPush ──────────────────────────────────────────────────

describe("getThreadMembersForPush", () => {
  it("returns members with user_id and last_read_at", async () => {
    const members = [
      { user_id: "u1", last_read_at: "2026-01-01T00:00:00Z" },
      { user_id: "u2", last_read_at: null },
    ];
    const chain = makeQueryChain({ data: members, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      chain as unknown as ReturnType<typeof supabaseAdmin.from>,
    );
    const result = await getThreadMembersForPush("t1");
    expect(result).toEqual(members);
  });

  it("returns empty array when no members", async () => {
    const chain = makeQueryChain({ data: null, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      chain as unknown as ReturnType<typeof supabaseAdmin.from>,
    );
    const result = await getThreadMembersForPush("t1");
    expect(result).toEqual([]);
  });

  it("throws on error", async () => {
    const chain = makeQueryChain({ data: null, error: new Error("push fail") });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      chain as unknown as ReturnType<typeof supabaseAdmin.from>,
    );
    await expect(getThreadMembersForPush("t1")).rejects.toThrow("push fail");
  });
});
