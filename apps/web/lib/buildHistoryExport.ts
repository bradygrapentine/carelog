/**
 * buildHistoryExport
 *
 * Pure helper: given { orgId, recipientId, supabaseAdmin }, fetches all care
 * history tables, de-tokenizes identity ONCE, and returns a structured snapshot.
 *
 * PHI rule: de-tokenize identity at generation time only — never store vault
 * data beyond this function's lifetime.
 */

import { type SupabaseClient } from "@supabase/supabase-js";

export type HistoryExportSnapshot = {
  generated_at: string;
  recipient_id: string;
  recipient_name: string;
  dob: string | null;
  care_events: CareEventRow[];
  medications: MedicationRow[];
  symptom_readings: SymptomReadingRow[];
  eol_plan: EolPlanRow | null;
  documents_metadata: DocumentMetadataRow[];
};

export type CareEventRow = {
  id: string;
  occurred_at: string;
  event_type: string;
  entry_kind: string | null;
  payload: Record<string, unknown> | null;
  flagged: boolean;
  created_at: string;
};

export type MedicationRow = {
  id: string;
  drug_name: string;
  dosage: string | null;
  instructions: string | null;
  active: boolean;
  created_at: string;
};

export type SymptomReadingRow = {
  id: string;
  recorded_at: string;
  reading_type: string;
  value: number | null;
  unit: string | null;
  notes: string | null;
};

export type EolPlanRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  content: Record<string, unknown> | null;
};

export type DocumentMetadataRow = {
  id: string;
  created_at: string;
  file_name: string | null;
  file_type: string | null;
  uploaded_by: string | null;
};

export type ExportCounts = {
  care_events: number;
  medications: number;
  symptom_readings: number;
  eol_plan: boolean;
  documents_metadata: number;
};

export async function buildHistoryExport(opts: {
  orgId: string;
  recipientId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any>;
}): Promise<HistoryExportSnapshot> {
  const { orgId, recipientId, supabaseAdmin } = opts;

  // 1. Fetch recipient → identity_token
  const { data: recipient, error: recipientError } = await supabaseAdmin
    .from("care_recipients")
    .select("identity_token")
    .eq("id", recipientId)
    .eq("org_id", orgId)
    .single();

  if (recipientError || !recipient) {
    throw new Error("Recipient not found");
  }

  // 2. De-tokenize identity ONCE
  const { data: vault, error: vaultError } = await supabaseAdmin
    .from("identity_vault")
    .select("full_name, dob")
    .eq("token", recipient.identity_token)
    .single();

  if (vaultError || !vault) {
    throw new Error("Identity not found");
  }

  const recipientName: string = vault.full_name;
  const dob: string | null = vault.dob ?? null;

  // 3. Fetch all care events (full timeline, no date limit)
  const { data: careEvents } = await supabaseAdmin
    .from("care_events")
    .select(
      "id, occurred_at, event_type, entry_kind, payload, flagged, created_at",
    )
    .eq("recipient_id", recipientId)
    .eq("org_id", orgId)
    .order("occurred_at", { ascending: true });

  // 4. Fetch all medications
  const { data: medications } = await supabaseAdmin
    .from("medications")
    .select("id, drug_name, dosage, instructions, active, created_at")
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: true });

  // 5. Fetch symptom readings
  const { data: symptomReadings } = await supabaseAdmin
    .from("symptom_readings")
    .select("id, recorded_at, reading_type, value, unit, notes")
    .eq("recipient_id", recipientId)
    .order("recorded_at", { ascending: true });

  // 6. Fetch EOL plan (may not exist)
  const { data: eolPlan } = await supabaseAdmin
    .from("eol_plans")
    .select("id, created_at, updated_at, content")
    .eq("recipient_id", recipientId)
    .eq("org_id", orgId)
    .maybeSingle();

  // 7. Fetch documents metadata (not file contents)
  const { data: documents } = await supabaseAdmin
    .from("documents")
    .select("id, created_at, file_name, file_type, uploaded_by")
    .eq("recipient_id", recipientId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  return {
    generated_at: new Date().toISOString(),
    recipient_id: recipientId,
    recipient_name: recipientName,
    dob,
    care_events: (careEvents ?? []) as CareEventRow[],
    medications: (medications ?? []) as MedicationRow[],
    symptom_readings: (symptomReadings ?? []) as SymptomReadingRow[],
    eol_plan: (eolPlan ?? null) as EolPlanRow | null,
    documents_metadata: (documents ?? []) as DocumentMetadataRow[],
  };
}

export function buildExportCounts(
  snapshot: HistoryExportSnapshot,
): ExportCounts {
  return {
    care_events: snapshot.care_events.length,
    medications: snapshot.medications.length,
    symptom_readings: snapshot.symptom_readings.length,
    eol_plan: snapshot.eol_plan !== null,
    documents_metadata: snapshot.documents_metadata.length,
  };
}
