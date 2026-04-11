import * as SecureStore from "expo-secure-store";
import type { EventType } from "@carelog/types";

const QUEUE_KEY = "carelog_offline_queue";

export type OfflineEntryKind =
  | "journal_entry"
  | "medication_log"
  | "symptom_reading";

export interface QueuedWrite {
  id: string; // idempotency key — uuid
  event_type: EventType;
  entry_kind: OfflineEntryKind;
  payload: unknown;
  recipient_id: string;
  occurred_at: string; // captured at time of entry, never flush time
  attempts: number;
}

export async function enqueue(
  write: Omit<QueuedWrite, "attempts">,
): Promise<void> {
  const queue = await getQueue();
  const updated = [...queue, { ...write, attempts: 0 }];
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(updated));
}

export async function dequeue(id: string): Promise<void> {
  const queue = await getQueue();
  const updated = queue.filter((w) => w.id !== id);
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(updated));
}

export async function incrementAttempts(id: string): Promise<void> {
  const queue = await getQueue();
  const updated = queue.map((w) =>
    w.id === id ? { ...w, attempts: w.attempts + 1 } : w,
  );
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(updated));
}

export async function getQueue(): Promise<QueuedWrite[]> {
  try {
    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedWrite[]) : [];
  } catch {
    return [];
  }
}

export async function clearQueue(): Promise<void> {
  await SecureStore.deleteItemAsync(QUEUE_KEY);
}
