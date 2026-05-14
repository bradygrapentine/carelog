import { useEffect, useCallback } from "react";
import NetInfo from "@react-native-community/netinfo";
import {
  enqueue,
  dequeue,
  incrementAttempts,
  getQueue,
} from "../store/offlineQueue";
import type { OfflineEntryKind } from "../store/offlineQueue";
import type { EventType } from "@carelog/types";
import { trpc } from "../utils/trpc";
import { mutatorRegistry } from "../lib/offlineMutators";

const MAX_ATTEMPTS = 5;

export function useOfflineWrite(orgId: string) {
  const careEventsInsert = trpc.careEvents.insert.useMutation();
  const medLogAdmin = trpc.medications.logAdministration.useMutation();
  const symptomsLog = trpc.symptoms.log.useMutation();

  // Map kind → the appropriate mutateAsync (hook instances live here to satisfy React hook rules)
  const mutateByKind: Record<
    string,
    (args: Record<string, unknown>) => Promise<unknown>
  > = {
    journal_entry: (args) =>
      careEventsInsert.mutateAsync(
        args as Parameters<typeof careEventsInsert.mutateAsync>[0],
      ),
    medication_log: (args) =>
      medLogAdmin.mutateAsync(
        args as Parameters<typeof medLogAdmin.mutateAsync>[0],
      ),
    symptom_reading: (args) =>
      symptomsLog.mutateAsync(
        args as Parameters<typeof symptomsLog.mutateAsync>[0],
      ),
  };

  async function flushQueue() {
    const queue = await getQueue();
    if (queue.length === 0) return;

    for (const write of queue) {
      if (write.attempts >= MAX_ATTEMPTS) {
        await dequeue(write.id);
        continue;
      }
      try {
        const mutator = mutatorRegistry[write.entry_kind];
        const mutate = mutateByKind[write.entry_kind];
        await mutate(mutator.buildTrpcArgs(write, orgId));
        await dequeue(write.id);
      } catch {
        await incrementAttempts(write.id);
      }
    }
  }

  // Flush on reconnect
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        flushQueue().catch(console.error);
      }
    });
    return unsub;
  }, [orgId]);

  const write = useCallback(
    async (event: {
      event_type: EventType;
      entry_kind: OfflineEntryKind;
      payload: unknown;
      recipient_id: string;
    }) => {
      const id = crypto.randomUUID();
      const occurred_at = new Date().toISOString();
      // Always enqueue first — captures occurred_at at write time, not flush time
      await enqueue({ id, occurred_at, ...event });
      const net = await NetInfo.fetch();
      if (net.isConnected) {
        await flushQueue();
      }
    },
    [orgId],
  );

  return { write };
}
