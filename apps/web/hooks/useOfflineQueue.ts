"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useOnlineStatus } from "./useOnlineStatus";
import {
  getAll,
  getDeadLetters,
  markAttempt,
  queueDepth,
  removeEntry,
} from "../lib/offline-queue";
import { authenticatedFetch } from "../lib/authenticatedFetch";

type UseOfflineQueueReturn = {
  pendingQueueDepth: number;
  flushQueue: () => Promise<void>;
};

export function useOfflineQueue(
  orgId: string | null,
  loadEvents: () => Promise<void>,
): UseOfflineQueueReturn {
  const { isOnline } = useOnlineStatus();
  const prevOnlineRef = useRef<boolean>(isOnline);
  const flushingRef = useRef(false);
  const [pendingQueueDepth, setPendingQueueDepth] = useState(0);

  const refreshQueueDepth = useCallback(async () => {
    const depth = await queueDepth();
    setPendingQueueDepth(depth);
  }, []);

  const flushQueue = useCallback(async () => {
    if (!orgId) return;
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const all = await getAll();
      const pending = all.filter((e) => e.attempts < 3);
      if (pending.length === 0) return;

      let flushedCount = 0;
      for (const entry of pending) {
        try {
          await authenticatedFetch("/api/journal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipientId: entry.recipientId,
              orgId,
              text: entry.payload.text,
              mood: entry.payload.mood,
              clientId: entry.id,
            }),
          });
          await removeEntry(entry.id);
          flushedCount++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          await markAttempt(entry.id, msg);
        }
      }

      if (flushedCount > 0) {
        await loadEvents();
        toast.success(
          `Synced ${flushedCount} queued ${flushedCount === 1 ? "entry" : "entries"}`,
        );
      }

      const dead = await getDeadLetters();
      if (dead.length > 0) {
        toast.error(
          `${dead.length} ${dead.length === 1 ? "entry" : "entries"} failed to sync after 3 attempts`,
        );
      }

      await refreshQueueDepth();
    } finally {
      flushingRef.current = false;
    }
  }, [orgId, loadEvents, refreshQueueDepth]);

  // Refresh queue depth on mount
  useEffect(() => {
    refreshQueueDepth();
  }, [refreshQueueDepth]);

  // Flush queue when coming back online
  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;
    if (isOnline && wasOffline && orgId) {
      flushQueue();
    }
  }, [isOnline, orgId, flushQueue]);

  return { pendingQueueDepth, flushQueue };
}
