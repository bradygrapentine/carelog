import { z } from "zod";

// Tag a care event with a medication (manual)
export const tagCareEventInput = z.object({
  care_event_id: z.string().uuid(),
  medication_id: z.string().uuid(),
  org_id: z.string().uuid(),
});

// Tag a document with a medication (manual, coordinator only)
export const tagDocumentInput = z.object({
  document_id: z.string().uuid(),
  medication_id: z.string().uuid(),
  org_id: z.string().uuid(),
});

// Untag
export const untagCareEventInput = z.object({
  tag_id: z.string().uuid(),
  org_id: z.string().uuid(),
});

export const untagDocumentInput = z.object({
  tag_id: z.string().uuid(),
  org_id: z.string().uuid(),
});

// List tags for a care event
export const listTagsForEventInput = z.object({
  care_event_id: z.string().uuid(),
});

// List tags for a document
export const listTagsForDocumentInput = z.object({
  document_id: z.string().uuid(),
});

// Get a single medication with linked data
export const medicationGetInput = z.object({
  medication_id: z.string().uuid(),
  org_id: z.string().uuid(),
});

// Output type for a medication tag (returned from list queries)
export type MedicationTag = {
  id: string;
  medication_id: string;
  drug_name: string;
  brand_name: string | null;
  confidence: "manual" | "auto";
  tagged_by: string | null;
  created_at: string;
};
