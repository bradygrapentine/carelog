/**
 * OcrJobStateMachine — enforces legal OCR job state transitions.
 *
 * Legal transition graph (mirrors ocr_status DB enum):
 *
 *   pending → processing
 *   processing → needs_review
 *   processing → failed
 *   needs_review → confirmed
 *   needs_review → failed
 *   * → failed   (any state can be failed/discarded)
 *
 * Optimistic lock: `transitionTo` accepts the job's current DB status and
 * validates the transition before the caller issues the UPDATE. The caller
 * must include `.eq("status", currentStatus)` in the Supabase UPDATE so that
 * a concurrent write (which already changed the status) causes 0 rows to be
 * updated — the caller detects this and returns 409.
 */

export type OcrStatus =
  | "pending"
  | "processing"
  | "needs_review"
  | "confirmed"
  | "failed";

/** Allowed (from → to) pairs. */
const LEGAL_TRANSITIONS: ReadonlyMap<
  OcrStatus,
  ReadonlySet<OcrStatus>
> = new Map([
  ["pending", new Set<OcrStatus>(["processing", "failed"])],
  ["processing", new Set<OcrStatus>(["needs_review", "failed"])],
  ["needs_review", new Set<OcrStatus>(["confirmed", "failed"])],
  // Terminal states — no outbound transitions.
  ["confirmed", new Set<OcrStatus>()],
  ["failed", new Set<OcrStatus>()],
]);

export class OcrJobStateMachine {
  readonly currentStatus: OcrStatus;

  constructor(currentStatus: OcrStatus) {
    this.currentStatus = currentStatus;
  }

  /**
   * Returns `true` if transitioning from `currentStatus` to `target` is legal.
   * Does NOT mutate state or touch the DB — the caller owns the DB write.
   */
  canTransitionTo(target: OcrStatus): boolean {
    return LEGAL_TRANSITIONS.get(this.currentStatus)?.has(target) ?? false;
  }

  /**
   * Validates the transition. Returns the target status if legal.
   * Throws `OcrTransitionError` if the transition is illegal.
   */
  transitionTo(target: OcrStatus): OcrStatus {
    if (!this.canTransitionTo(target)) {
      throw new OcrTransitionError(this.currentStatus, target);
    }
    return target;
  }
}

export class OcrTransitionError extends Error {
  readonly from: OcrStatus;
  readonly to: OcrStatus;

  constructor(from: OcrStatus, to: OcrStatus) {
    super(`Illegal OCR job transition: ${from} → ${to}`);
    this.name = "OcrTransitionError";
    this.from = from;
    this.to = to;
  }
}
