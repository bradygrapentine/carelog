import { useEffect, useCallback } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { enqueue, dequeue, incrementAttempts, getQueue } from '../store/offlineQueue'
import type { EventType } from '@carelog/types'
import { trpc } from '../utils/trpc'

const MAX_ATTEMPTS = 5

type InsertFn = (input: {
  orgId: string
  recipientId: string
  eventType: string
  entryKind: 'human' | 'system'
  payload: Record<string, unknown>
  occurredAt: string
  idempotencyKey: string
}) => Promise<unknown>

async function flushQueue(insertFn: InsertFn, orgId: string) {
  const queue = await getQueue()
  if (queue.length === 0) return

  for (const write of queue) {
    if (write.attempts >= MAX_ATTEMPTS) {
      await dequeue(write.id)
      continue
    }
    try {
      await insertFn({
        orgId,
        recipientId: write.recipient_id,
        eventType: write.event_type,
        entryKind: write.entry_kind,
        payload: write.payload as Record<string, unknown>,
        occurredAt: write.occurred_at,
        idempotencyKey: write.id,
      })
      await dequeue(write.id)
    } catch {
      await incrementAttempts(write.id)
    }
  }
}

export function useOfflineWrite(orgId: string) {
  const insertMutation = trpc.careEvents.insert.useMutation()

  const insertFn: InsertFn = (input) => insertMutation.mutateAsync(input as Parameters<typeof insertMutation.mutateAsync>[0])

  // Flush on reconnect
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        flushQueue(insertFn, orgId).catch(console.error)
      }
    })
    return unsub
  }, [orgId])

  const write = useCallback(
    async (event: {
      event_type: EventType
      entry_kind: 'human' | 'system'
      payload: unknown
      recipient_id: string
    }) => {
      const id = crypto.randomUUID()
      const occurred_at = new Date().toISOString()
      // Always enqueue first — captures occurred_at at write time, not flush time
      await enqueue({ id, occurred_at, ...event })
      const net = await NetInfo.fetch()
      if (net.isConnected) {
        await flushQueue(insertFn, orgId)
      }
    },
    [orgId],
  )

  return { write }
}
