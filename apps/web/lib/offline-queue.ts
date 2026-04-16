import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "carelog-offline";
const STORE_NAME = "journal-queue";
const MAX_DEPTH = 100;

export type QueuedJournalEntry = {
  id: string; // client UUID
  orgId: string;
  recipientId: string;
  createdAt: string; // ISO timestamp
  payload: { text: string; mood?: string };
  attempts: number;
  lastError?: string;
};

export class QueueFullError extends Error {
  constructor() {
    super(`Offline queue is full (max ${MAX_DEPTH} entries)`);
    this.name = "QueueFullError";
  }
}

let _db: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    },
  });
  return _db;
}

export async function pushEntry(
  entry: Omit<QueuedJournalEntry, "attempts">,
): Promise<void> {
  const depth = await queueDepth();
  if (depth >= MAX_DEPTH) throw new QueueFullError();
  const db = await getDb();
  await db.put(STORE_NAME, { ...entry, attempts: 0 });
}

export async function getAll(): Promise<QueuedJournalEntry[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex(STORE_NAME, "createdAt");
  return all as QueuedJournalEntry[];
}

export async function markAttempt(id: string, error?: string): Promise<void> {
  const db = await getDb();
  const entry = (await db.get(STORE_NAME, id)) as
    | QueuedJournalEntry
    | undefined;
  if (!entry) return;
  await db.put(STORE_NAME, {
    ...entry,
    attempts: entry.attempts + 1,
    lastError: error,
  });
}

export async function removeEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
}

export async function getDeadLetters(): Promise<QueuedJournalEntry[]> {
  const all = await getAll();
  return all.filter((e) => e.attempts >= 3);
}

export async function clearAll(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE_NAME);
}

export async function queueDepth(): Promise<number> {
  const db = await getDb();
  return db.count(STORE_NAME);
}
