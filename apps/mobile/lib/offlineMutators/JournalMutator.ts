import type { QueuedWrite } from "../../store/offlineQueue";
import type { PayloadMutator, TrpcArgs } from "./index";

export class JournalMutator implements PayloadMutator {
  readonly kind = "journal_entry";

  buildTrpcArgs(write: QueuedWrite, orgId: string): TrpcArgs {
    return {
      orgId,
      recipientId: write.recipient_id,
      eventType: write.event_type,
      entryKind: "human",
      payload: write.payload as Record<string, unknown>,
      occurredAt: write.occurred_at,
      idempotencyKey: write.id,
    };
  }
}
