import { useEffect, useCallback } from "react";
import NetInfo from "@react-native-community/netinfo";
import {
  enqueue,
  dequeue,
  incrementAttempts,
  getQueue,
} from "../store/offlineQueue";
import type { OfflineEntryKind, QueuedWrite } from "../store/offlineQueue";
import type { EventType } from "@carelog/types";
import { trpc } from "../utils/trpc";

const MAX_ATTEMPTS = 5;

type MutationMap = {
  journal_entry: (write: QueuedWrite, orgId: string) => Promise<unknown>;
  medication_log: (write: QueuedWrite, orgId: string) => Promise<unknown>;
  symptom_reading: (write: QueuedWrite, orgId: string) => Promise<unknown>;
};

export function useOfflineWrite(orgId: string) {
  const careEventsInsert = trpc.careEvents.insert.useMutation();
  const medLogAdmin = trpc.medications.logAdministration.useMutation();
  const symptomsLog = trpc.symptoms.log.useMutation();

  const mutations: MutationMap = {
    journal_entry: (write, org) =>
      careEventsInsert.mutateAsync({
        orgId: org,
        recipientId: write.recipient_id,
        eventType: write.event_type,
        entryKind: "human",
        payload: write.payload as Record<string, unknown>,
        occurredAt: write.occurred_at,
        idempotencyKey: write.id,
      }),
    medication_log: (write, org) => {
      const p = write.payload as Record<string, unknown>;
      return medLogAdmin.mutateAsync({
        org_id: org,
        recipient_id: write.recipient_id,
        medication_id: p.medication_id as string,
        scheduled_time: p.scheduled_time as string,
        action: p.action as "given" | "missed",
      });
    },
    symptom_reading: (write, org) => {
      const p = write.payload as Record<string, unknown>;
      return symptomsLog.mutateAsync({
        org_id: org,
        recipient_id: write.recipient_id,
        ...(p.pain_level != null ? { pain_level: p.pain_level as number } : {}),
        ...(p.mood
          ? { mood: p.mood as "good" | "okay" | "difficult" | "crisis" }
          : {}),
        ...(p.appetite
          ? { appetite: p.appetite as "none" | "normal" | "reduced" | "poor" }
          : {}),
        ...(p.mobility
          ? {
              mobility: p.mobility as
                | "normal"
                | "limited"
                | "assisted"
                | "bedbound",
            }
          : {}),
        ...(p.notes ? { notes: p.notes as string } : {}),
      });
    },
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
        const mutate = mutations[write.entry_kind];
        await mutate(write, orgId);
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
