import type { QueuedWrite } from "../../store/offlineQueue";
import type { PayloadMutator, TrpcArgs } from "./index";

export class SymptomMutator implements PayloadMutator {
  readonly kind = "symptom_reading";

  buildTrpcArgs(write: QueuedWrite, orgId: string): TrpcArgs {
    const p = write.payload as Record<string, unknown>;
    return {
      org_id: orgId,
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
    };
  }
}
