import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi
    .fn()
    .mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}));
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));

import { appRouter } from "@/server/trpc/router";

const USER_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "single", "update", "upsert", "insert"];
  methods.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: USER_ID,
            email: "user@example.com",
            user_metadata: {},
          },
        },
        error: null,
      }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockReturnValue(chain),
    ...overrides,
  };
}

const authedCaller = (supabaseMock: ReturnType<typeof makeSupabaseMock>) =>
  appRouter.createCaller({
    user: { id: USER_ID, email: "user@example.com" } as any,
    supabase: supabaseMock as any,
    req: undefined,
  });

const anonCaller = appRouter.createCaller({
  user: null,
  supabase: {} as any,
  req: undefined,
});

// ─── (a) auth boundary tests ──────────────────────────────────────────────────

describe("user.getProfile — auth boundary", () => {
  it("throws UNAUTHORIZED when no user in context", async () => {
    await expect(anonCaller.user.getProfile()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("user.updateProfile — auth boundary", () => {
  it("throws UNAUTHORIZED when no user in context", async () => {
    await expect(
      anonCaller.user.updateProfile({ displayName: "Alice" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("user.dismissEducationTip — auth boundary", () => {
  it("throws UNAUTHORIZED when no user in context", async () => {
    await expect(anonCaller.user.dismissEducationTip()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("user.updateNotifications — auth boundary", () => {
  it("throws UNAUTHORIZED when no user in context", async () => {
    await expect(
      anonCaller.user.updateNotifications({ emailDigest: false }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ─── (b) IANA_TIMEZONE_PATTERN regex ─────────────────────────────────────────

describe("user.updateProfile — timezone validation", () => {
  let sb: ReturnType<typeof makeSupabaseMock>;

  beforeEach(() => {
    sb = makeSupabaseMock();
  });

  it("accepts a valid IANA timezone (America/New_York)", async () => {
    await expect(
      authedCaller(sb).user.updateProfile({ timezone: "America/New_York" }),
    ).resolves.toEqual({ ok: true });
  });

  it("accepts UTC", async () => {
    await expect(
      authedCaller(sb).user.updateProfile({ timezone: "UTC" }),
    ).resolves.toEqual({ ok: true });
  });

  it("accepts GMT", async () => {
    await expect(
      authedCaller(sb).user.updateProfile({ timezone: "GMT" }),
    ).resolves.toEqual({ ok: true });
  });

  it("accepts a three-segment IANA timezone (America/Indiana/Indianapolis)", async () => {
    await expect(
      authedCaller(sb).user.updateProfile({
        timezone: "America/Indiana/Indianapolis",
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("accepts empty string (clears timezone)", async () => {
    await expect(
      authedCaller(sb).user.updateProfile({ timezone: "" }),
    ).resolves.toEqual({ ok: true });
  });

  it("rejects plain text that is not a timezone", async () => {
    await expect(
      authedCaller(sb).user.updateProfile({ timezone: "not a tz" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects timezone with spaces", async () => {
    await expect(
      authedCaller(sb).user.updateProfile({ timezone: "America/ New_York" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects injection-y input with semicolon", async () => {
    await expect(
      authedCaller(sb).user.updateProfile({ timezone: "America/New_York;DROP TABLE users" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects injection-y input with single quote", async () => {
    await expect(
      authedCaller(sb).user.updateProfile({ timezone: "America/New'York" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects timezone starting with a slash", async () => {
    await expect(
      authedCaller(sb).user.updateProfile({ timezone: "/America/New_York" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects timezone with digits in region", async () => {
    await expect(
      authedCaller(sb).user.updateProfile({ timezone: "America/New_York123" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ─── (c) dismissEducationTip date math ────────────────────────────────────────

describe("user.dismissEducationTip — date math", () => {
  it("sets education_tip_dismissed_until to exactly 7 days from now", async () => {
    const before = Date.now();
    let capturedDate: string | undefined;

    const sb = makeSupabaseMock();
    const fromChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        capturedDate = payload.education_tip_dismissed_until as string;
        return {
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      }),
    };
    sb.from = vi.fn().mockReturnValue(fromChain);

    await authedCaller(sb).user.dismissEducationTip();

    const after = Date.now();
    expect(capturedDate).toBeDefined();
    const parsed = new Date(capturedDate!).getTime();

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    // Must be at least 7 days from before the call
    expect(parsed).toBeGreaterThanOrEqual(before + sevenDaysMs);
    // Must not exceed 7 days from after the call (same-day boundary, generous 5s window)
    expect(parsed).toBeLessThanOrEqual(after + sevenDaysMs + 5000);
  });

  it("does not set a date in the past", async () => {
    let capturedDate: string | undefined;

    const sb = makeSupabaseMock();
    const fromChain: any = {
      update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        capturedDate = payload.education_tip_dismissed_until as string;
        return { eq: vi.fn().mockResolvedValue({ error: null }) };
      }),
    };
    sb.from = vi.fn().mockReturnValue(fromChain);

    await authedCaller(sb).user.dismissEducationTip();

    expect(new Date(capturedDate!).getTime()).toBeGreaterThan(Date.now());
  });

  it("does not set a date more than 8 days from now (off-by-one guard)", async () => {
    let capturedDate: string | undefined;

    const sb = makeSupabaseMock();
    const fromChain: any = {
      update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        capturedDate = payload.education_tip_dismissed_until as string;
        return { eq: vi.fn().mockResolvedValue({ error: null }) };
      }),
    };
    sb.from = vi.fn().mockReturnValue(fromChain);

    await authedCaller(sb).user.dismissEducationTip();

    const eightDaysMs = 8 * 24 * 60 * 60 * 1000;
    expect(new Date(capturedDate!).getTime()).toBeLessThan(
      Date.now() + eightDaysMs,
    );
  });
});

// ─── (d) updateNotifications upsert idempotency ───────────────────────────────

describe("user.updateNotifications — upsert idempotency", () => {
  it("calling twice with same webPushEnabled payload calls upsert twice (idempotent)", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const sb = makeSupabaseMock();
    sb.from = vi.fn().mockReturnValue({ upsert: upsertMock });

    const caller = authedCaller(sb);
    await caller.user.updateNotifications({ webPushEnabled: true });
    await caller.user.updateNotifications({ webPushEnabled: true });

    // Both calls must hit the upsert (no short-circuit on same value)
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock).toHaveBeenNthCalledWith(
      1,
      { user_id: USER_ID, web_push_enabled: true },
      { onConflict: "user_id" },
    );
    expect(upsertMock).toHaveBeenNthCalledWith(
      2,
      { user_id: USER_ID, web_push_enabled: true },
      { onConflict: "user_id" },
    );
  });

  it("calling twice with same email preferences calls updateUser twice", async () => {
    const sb = makeSupabaseMock();
    const caller = authedCaller(sb);

    await caller.user.updateNotifications({ emailDigest: false });
    await caller.user.updateNotifications({ emailDigest: false });

    expect(sb.auth.updateUser).toHaveBeenCalledTimes(2);
    expect(sb.auth.updateUser).toHaveBeenNthCalledWith(1, {
      data: { email_digest: false },
    });
    expect(sb.auth.updateUser).toHaveBeenNthCalledWith(2, {
      data: { email_digest: false },
    });
  });

  it("skips updateUser when no email prefs in payload", async () => {
    const sb = makeSupabaseMock();
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    sb.from = vi.fn().mockReturnValue({ upsert: upsertMock });

    await authedCaller(sb).user.updateNotifications({ webPushEnabled: false });

    expect(sb.auth.updateUser).not.toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalledOnce();
  });
});
