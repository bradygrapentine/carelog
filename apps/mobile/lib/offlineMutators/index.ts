import type { QueuedWrite } from "../../store/offlineQueue";

/**
 * TrpcArgs — the argument shape each tRPC mutation accepts.
 * Typed as unknown so each mutator can return its own precise type;
 * the hook treats it as opaque and passes it straight to mutateAsync.
 */
export type TrpcArgs = Record<string, unknown>;

/**
 * PayloadMutator<T> — extracts per-kind tRPC argument building from useOfflineWrite.
 * T is the narrowed payload type for this kind (e.g. JournalPayload).
 */
export interface PayloadMutator<T = Record<string, unknown>> {
  readonly kind: string;
  buildTrpcArgs(write: QueuedWrite, orgId: string): TrpcArgs;
}

// ---- registry ---------------------------------------------------------------

import { JournalMutator } from "./JournalMutator";
import { MedicationMutator } from "./MedicationMutator";
import { SymptomMutator } from "./SymptomMutator";

const _mutators: PayloadMutator[] = [
  new JournalMutator(),
  new MedicationMutator(),
  new SymptomMutator(),
];

/**
 * mutatorRegistry — maps entry_kind → PayloadMutator.
 * Look up with `mutatorRegistry[write.entry_kind]`.
 */
export const mutatorRegistry: Record<string, PayloadMutator> =
  Object.fromEntries(_mutators.map((m) => [m.kind, m]));
