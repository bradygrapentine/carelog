import {
  enqueue,
  dequeue,
  getQueue,
  incrementAttempts,
  clearQueue,
} from "../offlineQueue";

// Mock SecureStore
const store: Record<string, string> = {};
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    store[key] = value;
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    delete store[key];
    return Promise.resolve();
  }),
}));

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  jest.clearAllMocks();
});

describe("offlineQueue", () => {
  it("enqueues a journal_entry write", async () => {
    await enqueue({
      id: "uuid-1",
      event_type: "journal",
      entry_kind: "journal_entry",
      payload: { text: "hello", mood: "good" },
      recipient_id: "r1",
      occurred_at: "2026-04-11T12:00:00Z",
    });
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].entry_kind).toBe("journal_entry");
    expect(queue[0].attempts).toBe(0);
  });

  it("enqueues a medication_log write", async () => {
    await enqueue({
      id: "uuid-2",
      event_type: "medication",
      entry_kind: "medication_log",
      payload: {
        medication_id: "m1",
        scheduled_time: "08:00",
        action: "given",
      },
      recipient_id: "r1",
      occurred_at: "2026-04-11T08:00:00Z",
    });
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].entry_kind).toBe("medication_log");
  });

  it("enqueues a symptom_reading write", async () => {
    await enqueue({
      id: "uuid-3",
      event_type: "symptom",
      entry_kind: "symptom_reading",
      payload: { pain_level: 5, mood: "okay" },
      recipient_id: "r1",
      occurred_at: "2026-04-11T14:00:00Z",
    });
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].entry_kind).toBe("symptom_reading");
  });

  it("dequeues by id", async () => {
    await enqueue({
      id: "uuid-1",
      event_type: "journal",
      entry_kind: "journal_entry",
      payload: { text: "hello" },
      recipient_id: "r1",
      occurred_at: "2026-04-11T12:00:00Z",
    });
    await dequeue("uuid-1");
    const queue = await getQueue();
    expect(queue).toHaveLength(0);
  });

  it("increments attempts for a write", async () => {
    await enqueue({
      id: "uuid-1",
      event_type: "journal",
      entry_kind: "journal_entry",
      payload: {},
      recipient_id: "r1",
      occurred_at: "2026-04-11T12:00:00Z",
    });
    await incrementAttempts("uuid-1");
    const queue = await getQueue();
    expect(queue[0].attempts).toBe(1);
  });

  it("clears entire queue", async () => {
    const SecureStore = require("expo-secure-store");
    await enqueue({
      id: "uuid-1",
      event_type: "journal",
      entry_kind: "journal_entry",
      payload: {},
      recipient_id: "r1",
      occurred_at: "2026-04-11T12:00:00Z",
    });
    await clearQueue();
    const queue = await getQueue();
    expect(queue).toHaveLength(0);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "v1:carelog:offline_queue",
    );
  });
});
