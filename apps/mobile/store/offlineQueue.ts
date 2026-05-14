import * as SecureStore from "expo-secure-store";
import type { EventType } from "@carelog/types";
import { KEYS, migratedGet } from "../lib/secureStoreKeys";

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
  await SecureStore.setItemAsync(KEYS.offlineQueue, JSON.stringify(updated));
}

export async function dequeue(id: string): Promise<void> {
  const queue = await getQueue();
  const updated = queue.filter((w) => w.id !== id);
  await SecureStore.setItemAsync(KEYS.offlineQueue, JSON.stringify(updated));
}

export async function incrementAttempts(id: string): Promise<void> {
  const queue = await getQueue();
  const updated = queue.map((w) =>
    w.id === id ? { ...w, attempts: w.attempts + 1 } : w,
  );
  await SecureStore.setItemAsync(KEYS.offlineQueue, JSON.stringify(updated));
}

export async function getQueue(): Promise<QueuedWrite[]> {
  try {
    // migratedGet handles devices with queue stored under old key "carelog_offline_queue".
    const raw = await migratedGet(KEYS.offlineQueue, "carelog_offline_queue");
    return raw ? (JSON.parse(raw) as QueuedWrite[]) : [];
  } catch {
    return [];
  }
}

export async function clearQueue(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.offlineQueue);
}
