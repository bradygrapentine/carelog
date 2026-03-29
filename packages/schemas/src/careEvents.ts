import { z } from "zod";

export const journalPayload = z.object({
  text: z.string().min(1).max(10000),
  mood: z.enum(["good", "okay", "difficult", "crisis"]).optional(),
  flagReason: z.string().optional(),
  prompt_used: z.string().optional(),
});

export const medicationPayload = z.object({
  medication_id: z.string().uuid(),
  schedule_id: z.string().uuid().optional(),
  given: z.boolean(),
  photo_url: z.string().url().optional(),
  missed_reason: z.string().optional(),
  administered_by: z.string().uuid(),
});

export const shiftPayload = z.object({
  shift_id: z.string().uuid(),
  action: z.enum(["started", "completed", "missed", "covered"]),
  handoff_note: z.string().optional(),
});

export const appointmentPayload = z.object({
  title: z.string(),
  provider: z.string().optional(),
  location: z.string().optional(),
  transport_by: z.string().uuid().optional(),
  prep_notes: z.string().optional(),
  outcome_notes: z.string().optional(),
});

export const symptomPayload = z.object({
  pain_level: z.number().min(0).max(10).optional(),
  mood_score: z.number().min(0).max(10).optional(),
  appetite: z.enum(["good", "fair", "poor"]).optional(),
  mobility: z.enum(["normal", "reduced", "minimal"]).optional(),
  notes: z.string().optional(),
  vitals: z
    .object({
      blood_pressure: z.string().optional(),
      heart_rate: z.number().optional(),
      temperature: z.number().optional(),
      weight: z.number().optional(),
    })
    .optional(),
});

export const taskPayload = z.object({
  title: z.string(),
  completed_by: z.string().uuid(),
  notes: z.string().optional(),
});

export const expensePayload = z.object({
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  category: z.enum([
    "medication",
    "equipment",
    "transport",
    "aide",
    "medical",
    "other",
  ]),
  paid_by: z.string().uuid(),
  description: z.string().optional(),
  receipt_url: z.string().url().optional(),
});

export const handoffPayload = z.object({
  shift_id: z.string().uuid(),
  outgoing_aide: z.string().uuid(),
  notes: z.string().min(1),
  flags: z.array(z.string()).default([]),
});

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

export type EventType = keyof typeof payloadSchemas;
export type PayloadFor<T extends EventType> = z.infer<
  (typeof payloadSchemas)[T]
>;

export function validatePayload<T extends EventType>(
  type: T,
  payload: unknown,
): PayloadFor<T> {
  const schema = payloadSchemas[type];
  if (!schema) throw new Error(`Unknown event type: ${type}`);
  return schema.parse(payload) as PayloadFor<T>;
}
