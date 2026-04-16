// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi
    .fn()
    .mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}));
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));
vi.mock("@/server/repositories/shiftTradeRequestsRepository", () => ({
  createRequest: vi.fn(),
  respondToRequest: vi.fn(),
  acceptRequest: vi.fn(),
  forceOverride: vi.fn(),
  listForShift: vi.fn(),
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import * as repo from "@/server/repositories/shiftTradeRequestsRepository";
import { appRouter } from "@/server/trpc/router";

const ORG_ID = "11dc6d19-6712-4b26-8797-b4e544e01b80";
const USER_ID = "22dc6d19-6712-4b26-8797-b4e544e01b81";
const SHIFT_ID = "33dc6d19-6712-4b26-8797-b4e544e01b82";
const REQUEST_ID = "44dc6d19-6712-4b26-8797-b4e544e01b83";
const TARGET_USER_ID = "55dc6d19-6712-4b26-8797-b4e544e01b84";

const authedCaller = appRouter.createCaller({
  user: { id: USER_ID, email: "user@example.com" } as any,
  supabase: { from: vi.fn() } as any,
  req: undefined,
});

// Shift row with assignee matching USER_ID
const shiftRow = {
  id: SHIFT_ID,
  org_id: ORG_ID,
  assignee_user_id: USER_ID,
};

// Trade request row
const tradeRow = {
  id: REQUEST_ID,
  shift_id: SHIFT_ID,
  org_id: ORG_ID,
  requested_by: USER_ID,
  status: "open",
};

// Builds a supabaseAdmin.from chain that terminates with .single()
function makeShiftLookupChain(
  data: object | null,
  error: object | null = null,
) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
  };
  chain.single = vi.fn().mockResolvedValue({ data, error });
  return chain;
}

// Coordinator membership chain
function makeCoordinatorChain() {
  const chain: any = { select: () => chain, eq: () => chain };
  chain.single = vi.fn().mockResolvedValue({
    data: { role: "coordinator", accepted_at: "2026-01-01" },
    error: null,
  });
  return chain;
}

// Non-coordinator membership chain (forbidden)
function makeNonCoordinatorChain() {
  const chain: any = { select: () => chain, eq: () => chain };
  chain.single = vi.fn().mockResolvedValue({
    data: { role: "caregiver", accepted_at: "2026-01-01" },
    error: null,
  });
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  vi.mocked(repo.createRequest).mockReset();
  vi.mocked(repo.respondToRequest).mockReset();
  vi.mocked(repo.acceptRequest).mockReset();
  vi.mocked(repo.forceOverride).mockReset();
  vi.mocked(repo.listForShift).mockReset();
});

// ─── shiftTradeRequests.create ───────────────────────────────────────────────

describe("shiftTradeRequests.create — logic", () => {
  it("calls createRequest with correct params and returns result", async () => {
    // supabaseAdmin.from is called twice: shift lookup (assignee check) on "shifts"
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeShiftLookupChain(shiftRow),
    );
    vi.mocked(repo.createRequest).mockResolvedValue(tradeRow as any);

    const result = await authedCaller.shiftTradeRequests.create({
      shiftId: SHIFT_ID,
      message: "Can someone cover me?",
    });

    expect(result).toEqual(tradeRow);
    expect(vi.mocked(repo.createRequest)).toHaveBeenCalledWith(
      expect.anything(), // ctx.supabase
      expect.objectContaining({
        shiftId: SHIFT_ID,
        orgId: ORG_ID,
        requestedBy: USER_ID,
        message: "Can someone cover me?",
      }),
    );
  });

  it("fetches orgId from the shifts table", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeShiftLookupChain(shiftRow),
    );
    vi.mocked(repo.createRequest).mockResolvedValue(tradeRow as any);

    await authedCaller.shiftTradeRequests.create({ shiftId: SHIFT_ID });

    expect(vi.mocked(supabaseAdmin.from)).toHaveBeenCalledWith("shifts");
  });

  it("throws FORBIDDEN when caller is not the shift assignee", async () => {
    const otherShiftRow = { ...shiftRow, assignee_user_id: TARGET_USER_ID };
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeShiftLookupChain(otherShiftRow),
    );

    await expect(
      authedCaller.shiftTradeRequests.create({ shiftId: SHIFT_ID }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws NOT_FOUND when shift does not exist", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeShiftLookupChain(null, { message: "no rows" }),
    );

    await expect(
      authedCaller.shiftTradeRequests.create({ shiftId: SHIFT_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("passes targetUserId when provided", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeShiftLookupChain(shiftRow),
    );
    vi.mocked(repo.createRequest).mockResolvedValue(tradeRow as any);

    await authedCaller.shiftTradeRequests.create({
      shiftId: SHIFT_ID,
      targetUserId: TARGET_USER_ID,
    });

    expect(vi.mocked(repo.createRequest)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ targetUserId: TARGET_USER_ID }),
    );
  });
});

// ─── shiftTradeRequests.respond ──────────────────────────────────────────────

describe("shiftTradeRequests.respond — logic", () => {
  it("calls respondToRequest with correct args when action=decline", async () => {
    vi.mocked(repo.respondToRequest).mockResolvedValue({
      ...tradeRow,
      status: "declined",
    } as any);

    const result = await authedCaller.shiftTradeRequests.respond({
      requestId: REQUEST_ID,
      action: "decline",
    });

    expect(result).toMatchObject({ status: "declined" });
    expect(vi.mocked(repo.respondToRequest)).toHaveBeenCalledWith(
      expect.anything(), // ctx.supabase
      REQUEST_ID,
      USER_ID,
      "decline",
    );
  });

  it("calls acceptRequest (atomic) when action=accept", async () => {
    vi.mocked(repo.acceptRequest).mockResolvedValue({
      ...tradeRow,
      status: "accepted",
    } as any);

    const result = await authedCaller.shiftTradeRequests.respond({
      requestId: REQUEST_ID,
      action: "accept",
    });

    expect(result).toMatchObject({ status: "accepted" });
    expect(vi.mocked(repo.acceptRequest)).toHaveBeenCalledWith(
      REQUEST_ID,
      USER_ID,
    );
    // respondToRequest must NOT have been called
    expect(vi.mocked(repo.respondToRequest)).not.toHaveBeenCalled();
  });
});

// ─── shiftTradeRequests.forceOverride ────────────────────────────────────────

describe("shiftTradeRequests.forceOverride — logic", () => {
  it("calls forceOverride repo fn when caller is coordinator", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeCoordinatorChain());
    vi.mocked(repo.forceOverride).mockResolvedValue({
      ...tradeRow,
      status: "cancelled",
    } as any);

    const result = await authedCaller.shiftTradeRequests.forceOverride({
      requestId: REQUEST_ID,
      orgId: ORG_ID,
      action: "cancel",
    });

    expect(result).toMatchObject({ status: "cancelled" });
    expect(vi.mocked(repo.forceOverride)).toHaveBeenCalledWith(
      REQUEST_ID,
      USER_ID,
      ORG_ID,
      "cancel",
    );
  });

  it("throws FORBIDDEN when caller is not coordinator", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeNonCoordinatorChain());

    await expect(
      authedCaller.shiftTradeRequests.forceOverride({
        requestId: REQUEST_ID,
        orgId: ORG_ID,
        action: "cancel",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(vi.mocked(repo.forceOverride)).not.toHaveBeenCalled();
  });
});

// ─── shiftTradeRequests.list ─────────────────────────────────────────────────

describe("shiftTradeRequests.list — logic", () => {
  it("calls listForShift and returns results", async () => {
    const rows = [tradeRow, { ...tradeRow, id: "another-id" }];
    vi.mocked(repo.listForShift).mockResolvedValue(rows as any);

    const result = await authedCaller.shiftTradeRequests.list({
      shiftId: SHIFT_ID,
    });

    expect(result).toEqual(rows);
    expect(vi.mocked(repo.listForShift)).toHaveBeenCalledWith(
      expect.anything(), // ctx.supabase
      SHIFT_ID,
      undefined,
    );
  });

  it("passes status filter to listForShift", async () => {
    vi.mocked(repo.listForShift).mockResolvedValue([tradeRow] as any);

    await authedCaller.shiftTradeRequests.list({
      shiftId: SHIFT_ID,
      status: ["open"],
    });

    expect(vi.mocked(repo.listForShift)).toHaveBeenCalledWith(
      expect.anything(),
      SHIFT_ID,
      ["open"],
    );
  });

  it("returns empty array when no requests exist", async () => {
    vi.mocked(repo.listForShift).mockResolvedValue([]);

    const result = await authedCaller.shiftTradeRequests.list({
      shiftId: SHIFT_ID,
    });

    expect(result).toEqual([]);
  });
});
