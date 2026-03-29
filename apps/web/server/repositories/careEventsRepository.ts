import type { SupabaseClient } from "@supabase/supabase-js";
import { validatePayload } from "@carelog/schemas";
import type { CareEvent, EventType, EntryKind } from "@carelog/types";

export interface InsertEventParams {
  orgId: string;
  recipientId: string;
  actorId: string;
  eventType: EventType;
  entryKind: EntryKind;
  payload: unknown;
  occurredAt?: string;
  flagged?: boolean;
}

export async function getTimeline(
  supabase: SupabaseClient,
  params: {
    recipientId: string;
    eventType?: EventType;
    limit?: number;
    before?: string;
  },
): Promise<CareEvent[]> {
  let query = supabase
    .from("care_events")
    .select("*")
    .eq("recipient_id", params.recipientId)
    .order("occurred_at", { ascending: false })
    .limit(params.limit ?? 50);

  if (params.eventType) {
    query = query.eq("event_type", params.eventType);
  }

  if (params.before) {
    query = query.lt("occurred_at", params.before);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Timeline fetch failed: ${error.message}`);
  return (data ?? []) as CareEvent[];
}

export async function insertEvent(
  supabase: SupabaseClient,
  params: InsertEventParams,
): Promise<CareEvent> {
  // validatePayload() throws a ZodError if the payload doesn't match the schema
  // for this event_type. The error is thrown before any DB write, so invalid
  // payloads never reach care_events. See packages/schemas/src/careEvents.ts.
  const validatedPayload = validatePayload(params.eventType, params.payload);

  const { data, error } = await supabase
    .from("care_events")
    .insert({
      org_id: params.orgId,
      recipient_id: params.recipientId,
      actor_id: params.actorId,
      event_type: params.eventType,
      entry_kind: params.entryKind,
      payload: validatedPayload,
      occurred_at: params.occurredAt ?? new Date().toISOString(),
      flagged: params.flagged ?? false,
    })
    .select()
    .single();

  if (error) throw new Error(`Event insert failed: ${error.message}`);
  return data as CareEvent;
}

export async function getFlaggedEvents(
  supabase: SupabaseClient,
  recipientId: string,
): Promise<CareEvent[]> {
  const { data, error } = await supabase
    .from("care_events")
    .select("*")
    .eq("recipient_id", recipientId)
    .eq("flagged", true)
    .order("occurred_at", { ascending: false });

  if (error) throw new Error(`Flagged events fetch failed: ${error.message}`);
  return (data ?? []) as CareEvent[];
}

// Used by the mobile offline queue to flush events after reconnection.
// If the device goes offline mid-flush and retries, the idempotency key prevents
// duplicate rows — the first successful insert wins, subsequent calls return null.
// The key is stored inside the payload jsonb so it's visible in the event log.
export async function insertEventIdempotent(
  supabase: SupabaseClient,
  params: InsertEventParams & { idempotencyKey: string },
): Promise<CareEvent | null> {
  const { data: existing } = await supabase
    .from("care_events")
    .select("id")
    .eq("org_id", params.orgId)
    .eq("actor_id", params.actorId)
    .contains("payload", { idempotency_key: params.idempotencyKey })
    .maybeSingle();

  if (existing) return null; // Already inserted — skip

  const payloadWithKey = {
    ...(params.payload as object),
    idempotency_key: params.idempotencyKey,
  };

  return insertEvent(supabase, { ...params, payload: payloadWithKey });
}
