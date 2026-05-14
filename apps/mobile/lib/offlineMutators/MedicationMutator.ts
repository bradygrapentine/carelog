import type { QueuedWrite } from "../../store/offlineQueue";
import type { PayloadMutator, TrpcArgs } from "./index";

export class MedicationMutator implements PayloadMutator {
  readonly kind = "medication_log";

  buildTrpcArgs(write: QueuedWrite, orgId: string): TrpcArgs {
    const p = write.payload as Record<string, unknown>;
    return {
      org_id: orgId,
      recipient_id: write.recipient_id,
      medication_id: p.medication_id as string,
      scheduled_time: p.scheduled_time as string,
      action: p.action as "given" | "missed",
    };
  }
}
