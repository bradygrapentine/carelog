import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";

// Reset IDB state between tests by clearing the module cache
vi.mock("../offline-queue", async () => {
  const actual =
    await vi.importActual<typeof import("../offline-queue")>(
      "../offline-queue",
    );
  return actual;
});

// We import after setting up fake-indexeddb so the module uses the fake implementation
import {
  pushEntry,
  getAll,
  removeEntry,
  clearAll,
  queueDepth,
  markAttempt,
  getDeadLetters,
  QueueFullError,
} from "../offline-queue";

const makeEntry = (id: string, overrides = {}) => ({
  id,
  orgId: "org-1",
  recipientId: "rec-1",
  createdAt: new Date().toISOString(),
  payload: { text: "Hello world", mood: "good" as const },
  ...overrides,
});

describe("offline-queue", () => {
  beforeEach(async () => {
    await clearAll();
  });

  it("pushEntry adds an entry and queueDepth reflects it", async () => {
    await pushEntry(makeEntry("e1"));
    expect(await queueDepth()).toBe(1);
  });

  it("getAll returns entries in createdAt order", async () => {
    const now = Date.now();
    await pushEntry(
      makeEntry("e1", { createdAt: new Date(now).toISOString() }),
    );
    await pushEntry(
      makeEntry("e2", { createdAt: new Date(now + 1000).toISOString() }),
    );
    const all = await getAll();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe("e1");
    expect(all[1].id).toBe("e2");
  });

  it("removeEntry deletes the specified entry", async () => {
    await pushEntry(makeEntry("e1"));
    await pushEntry(makeEntry("e2"));
    await removeEntry("e1");
    const all = await getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("e2");
  });

  it("clearAll removes all entries", async () => {
    await pushEntry(makeEntry("e1"));
    await pushEntry(makeEntry("e2"));
    await clearAll();
    expect(await queueDepth()).toBe(0);
  });

  it("markAttempt increments attempts and records lastError", async () => {
    await pushEntry(makeEntry("e1"));
    await markAttempt("e1", "Network error");
    const all = await getAll();
    expect(all[0].attempts).toBe(1);
    expect(all[0].lastError).toBe("Network error");
  });

  it("markAttempt increments attempts on subsequent calls", async () => {
    await pushEntry(makeEntry("e1"));
    await markAttempt("e1", "err1");
    await markAttempt("e1", "err2");
    const all = await getAll();
    expect(all[0].attempts).toBe(2);
    expect(all[0].lastError).toBe("err2");
  });

  it("getDeadLetters returns entries with attempts >= 3", async () => {
    await pushEntry(makeEntry("e1"));
    await pushEntry(makeEntry("e2"));
    // Drive e1 to dead-letter status
    await markAttempt("e1");
    await markAttempt("e1");
    await markAttempt("e1");
    const dead = await getDeadLetters();
    expect(dead).toHaveLength(1);
    expect(dead[0].id).toBe("e1");
  });

  it("throws QueueFullError when depth reaches MAX_DEPTH (100)", async () => {
    // Fill to capacity
    for (let i = 0; i < 100; i++) {
      await pushEntry(
        makeEntry(`e${i}`, {
          createdAt: new Date(Date.now() + i).toISOString(),
        }),
      );
    }
    expect(await queueDepth()).toBe(100);
    await expect(pushEntry(makeEntry("overflow"))).rejects.toThrow(
      QueueFullError,
    );
  });

  it("markAttempt on non-existent id is a no-op", async () => {
    await expect(markAttempt("ghost", "err")).resolves.toBeUndefined();
  });
});
