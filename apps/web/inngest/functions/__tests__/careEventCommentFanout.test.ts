import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../server/repositories/careEventCommentsRepository", () => ({
  getFanoutTargets: vi.fn(),
}));
vi.mock("../../pushNotification", () => ({
  sendExpoPush: vi.fn().mockResolvedValue(undefined),
  getPushTokensForUsers: vi.fn(),
}));

const mockSupabaseFrom = vi.hoisted(() => vi.fn());
vi.mock("../../../server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: mockSupabaseFrom },
}));

import * as repo from "../../../server/repositories/careEventCommentsRepository";
import * as push from "../../pushNotification";
import { runFanout } from "../careEventCommentFanout";

function mockPrefs(userPrefs: Record<string, boolean>) {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "care_event_comments") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => ({ data: { body: "test comment" } }),
          }),
        }),
      };
    }
    return {
      select: () => ({
        in: (_col: string, ids: string[]) => ({
          data: ids.map((id) => ({
            user_id: id,
            care_event_comments: userPrefs[id] ?? true,
            push_enabled: true,
          })),
          error: null,
        }),
      }),
    };
  });
}

describe("careEventCommentFanout.runFanout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pushes to author + prior commenters, excluding current commenter", async () => {
    (repo.getFanoutTargets as any).mockResolvedValue({
      orgId: "org-1",
      eventAuthorId: "alice",
      priorCommenterIds: ["bob", "carol"],
    });
    mockPrefs({});
    (push.getPushTokensForUsers as any).mockResolvedValue([
      "tok-alice",
      "tok-bob",
      "tok-carol",
    ]);

    const result = await runFanout({
      commentId: "c1",
      careEventId: "e1",
      orgId: "org-1",
      authorId: "dave",
    });

    const calledWith = (push.getPushTokensForUsers as any).mock
      .calls[0][0] as string[];
    expect(calledWith).toContain("alice");
    expect(calledWith).toContain("bob");
    expect(calledWith).toContain("carol");
    expect(calledWith).not.toContain("dave");
    expect(push.sendExpoPush).toHaveBeenCalled();
    expect(result.pushed).toBeGreaterThan(0);
  });

  it("excludes recipients who disabled care_event_comments", async () => {
    (repo.getFanoutTargets as any).mockResolvedValue({
      orgId: "org-1",
      eventAuthorId: "alice",
      priorCommenterIds: ["bob"],
    });
    mockPrefs({ bob: false });
    (push.getPushTokensForUsers as any).mockResolvedValue(["tok-alice"]);

    const result = await runFanout({
      commentId: "c1",
      careEventId: "e1",
      orgId: "org-1",
      authorId: "dave",
    });

    const calledWith = (push.getPushTokensForUsers as any).mock
      .calls[0][0] as string[];
    expect(calledWith).not.toContain("bob");
    expect(calledWith).toContain("alice");
    expect(result.pushed).toBe(1);
  });

  it("no-op when commenter is also the event author with no prior comments", async () => {
    (repo.getFanoutTargets as any).mockResolvedValue({
      orgId: "org-1",
      eventAuthorId: "dave",
      priorCommenterIds: [],
    });

    const result = await runFanout({
      commentId: "c1",
      careEventId: "e1",
      orgId: "org-1",
      authorId: "dave",
    });

    expect(result.pushed).toBe(0);
    expect(push.sendExpoPush).not.toHaveBeenCalled();
  });
});
