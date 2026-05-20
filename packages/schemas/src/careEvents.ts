import { z } from "zod";

// TD-210: the load-bearing length caps on care_events JSONB payload fields,
// named so the limit has a single source of truth and an explicit intent rather
// than a bare magic number repeated at the call site. NOTE: care_events.payload
// is `jsonb` with no per-field DB CHECK, so these are app-side validation only —
// they are deliberately NOT claimed to mirror a database constraint (no such
// constraint exists for these sub-fields). Adjust here when the product limit
// changes.
export const JOURNAL_TEXT_MAX = 10000;
export const HANDOFF_NOTE_MAX = 2000;

export const journalPayload = z.object({
  text: z.string().min(1).max(JOURNAL_TEXT_MAX),
  mood: z.enum(["good", "okay", "difficult", "crisis"]).optional(),
  flagReason: z.string().max(1000).optional(),
  prompt_used: z.string().max(500).optional(),
});

export const medicationPayload = z.object({
  medication_id: z.string().uuid(),
  schedule_id: z.string().uuid().optional(),
  given: z.boolean(),
  photo_url: z.string().url().max(2048).optional(),
  missed_reason: z.string().max(500).optional(),
  administered_by: z.string().uuid(),
});

export const shiftPayload = z.object({
  shift_id: z.string().uuid(),
  action: z.enum(["started", "completed", "missed", "covered"]),
  handoff_note: z.string().max(HANDOFF_NOTE_MAX).optional(),
});

export const appointmentPayload = z.object({
  title: z.string().min(1).max(200),
  provider: z.string().max(200).optional(),
  location: z.string().max(300).optional(),
  transport_by: z.string().uuid().optional(),
  prep_notes: z.string().max(5000).optional(),
  outcome_notes: z.string().max(5000).optional(),
});

export const symptomPayload = z.object({
  pain_level: z.number().min(0).max(10).optional(),
  mood_score: z.number().min(0).max(10).optional(),
  appetite: z.enum(["good", "fair", "poor"]).optional(),
  mobility: z.enum(["normal", "reduced", "minimal"]).optional(),
  notes: z.string().max(2000).optional(),
  vitals: z
    .object({
      blood_pressure: z.string().max(20).optional(),
      heart_rate: z.number().min(0).max(300).optional(),
      temperature: z.number().min(90).max(115).optional(),
      weight: z.number().min(0).max(1000).optional(),
    })
    .optional(),
});

export const taskPayload = z.object({
  title: z.string().min(1).max(200),
  completed_by: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

export const expensePayload = z.object({
  amount: z.number().positive().max(1_000_000),
  currency: z.string().length(3).default("USD"),
  category: z.enum([
    "medication",
    "equipment",
    "transport",
    "aide",
    "medical",
    "other",
  ]),
  paid_by: z.string().uuid(),
  description: z.string().max(500).optional(),
  receipt_url: z.string().url().max(2048).optional(),
});

export const handoffPayload = z.object({
  shift_id: z.string().uuid(),
  outgoing_aide: z.string().uuid(),
  notes: z.string().min(1).max(5000),
  flags: z.array(z.string().max(200)).max(50).default([]),
});

/** Map of event type names to their Zod payload schemas; used for runtime validation and type inference. */
export const payloadSchemas = {
  journal: journalPayload,
  medication: medicationPayload,
  shift: shiftPayload,
  appointment: appointmentPayload,
  symptom: symptomPayload,
  task: taskPayload,
  expense: expensePayload,
  handoff: handoffPayload,
} as const;

/** Union of all valid care event type string literals. */
export type EventType = keyof typeof payloadSchemas;
/** Infers the validated payload shape for a given `EventType`. */
export type PayloadFor<T extends EventType> = z.infer<
  (typeof payloadSchemas)[T]
>;

/** Validates `payload` against the Zod schema for the given event `type`, throwing if invalid. */
export function validatePayload<T extends EventType>(
  type: T,
  payload: unknown,
): PayloadFor<T> {
  const schema = payloadSchemas[type];
  if (!schema) throw new Error(`Unknown event type: ${type}`);
  return schema.parse(payload) as PayloadFor<T>;
}
