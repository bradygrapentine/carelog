import { supabaseAdmin } from "../supabaseAdmin.server";
import type { MedicationTag } from "@carelog/schemas";

// ── Manual tag / untag ────────────────────────────────────────────────────────

export async function tagCareEvent(params: {
  careEventId: string;
  medicationId: string;
  orgId: string;
  confidence: "manual" | "auto";
  taggedBy: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("care_event_medications").upsert(
    {
      care_event_id: params.careEventId,
      medication_id: params.medicationId,
      org_id: params.orgId,
      confidence: params.confidence,
      tagged_by: params.taggedBy,
    },
    { ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

export async function untagCareEvent(tagId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("care_event_medications")
    .delete()
    .eq("id", tagId);
  if (error) throw new Error(error.message);
}

export async function listTagsForCareEvent(
  careEventId: string,
): Promise<MedicationTag[]> {
  const { data, error } = await supabaseAdmin
    .from("care_event_medications")
    .select(
      "id, medication_id, confidence, tagged_by, created_at, medications(drug_name, brand_name)",
    )
    .eq("care_event_id", careEventId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const rawMed = (row as unknown as Record<string, unknown>).medications;
    const medArr = Array.isArray(rawMed) ? rawMed : rawMed ? [rawMed] : [];
    const med = (medArr[0] ?? null) as {
      drug_name: string;
      brand_name: string | null;
    } | null;
    return {
      id: row.id as string,
      medication_id: row.medication_id as string,
      drug_name: med?.drug_name ?? "",
      brand_name: med?.brand_name ?? null,
      confidence: row.confidence as "manual" | "auto",
      tagged_by: (row.tagged_by as string | null) ?? null,
      created_at: row.created_at as string,
    };
  });
}

export async function tagDocument(params: {
  documentId: string;
  medicationId: string;
  orgId: string;
  confidence: "manual" | "auto";
  taggedBy: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("document_medications").upsert(
    {
      document_id: params.documentId,
      medication_id: params.medicationId,
      org_id: params.orgId,
      confidence: params.confidence,
      tagged_by: params.taggedBy,
    },
    { ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

export async function untagDocument(tagId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("document_medications")
    .delete()
    .eq("id", tagId);
  if (error) throw new Error(error.message);
}

export async function listTagsForDocument(
  documentId: string,
): Promise<MedicationTag[]> {
  const { data, error } = await supabaseAdmin
    .from("document_medications")
    .select(
      "id, medication_id, confidence, tagged_by, created_at, medications(drug_name, brand_name)",
    )
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const rawMed = (row as unknown as Record<string, unknown>).medications;
    const medArr = Array.isArray(rawMed) ? rawMed : rawMed ? [rawMed] : [];
    const med = (medArr[0] ?? null) as {
      drug_name: string;
      brand_name: string | null;
    } | null;
    return {
      id: row.id as string,
      medication_id: row.medication_id as string,
      drug_name: med?.drug_name ?? "",
      brand_name: med?.brand_name ?? null,
      confidence: row.confidence as "manual" | "auto",
      tagged_by: (row.tagged_by as string | null) ?? null,
      created_at: row.created_at as string,
    };
  });
}

// ── Auto-taggers ──────────────────────────────────────────────────────────────

export async function autoTagCareEvent(
  careEventId: string,
  orgId: string,
  recipientId: string,
): Promise<number> {
  try {
    const { data: eventData, error: eventError } = await supabaseAdmin
      .from("care_events")
      .select("payload")
      .eq("id", careEventId)
      .single();

    if (eventError || !eventData) {
      console.warn(
        `autoTagCareEvent: failed to fetch care event ${careEventId}: ${eventError?.message}`,
      );
      return 0;
    }

    // PHI rule: never log payload contents
    const payloadText = JSON.stringify(eventData.payload).toLowerCase();

    const { data: meds, error: medsError } = await supabaseAdmin
      .from("medications")
      .select("id, drug_name, brand_name")
      .eq("org_id", orgId)
      .eq("recipient_id", recipientId)
      .eq("active", true);

    if (medsError || !meds) {
      console.warn(
        `autoTagCareEvent: failed to fetch medications for org ${orgId}: ${medsError?.message}`,
      );
      return 0;
    }

    const matchingMedIds: string[] = [];
    for (const med of meds) {
      const terms = [med.drug_name, med.brand_name]
        .filter((s): s is string => Boolean(s))
        .map((s) => s.toLowerCase());
      if (terms.some((term) => payloadText.includes(term))) {
        matchingMedIds.push(med.id as string);
      }
    }

    if (matchingMedIds.length === 0) return 0;

    const rows = matchingMedIds.map((medicationId) => ({
      care_event_id: careEventId,
      medication_id: medicationId,
      org_id: orgId,
      confidence: "auto" as const,
      tagged_by: null,
    }));

    const { error: insertError, count } = await supabaseAdmin
      .from("care_event_medications")
      .upsert(rows, { ignoreDuplicates: true, count: "exact" });

    if (insertError) {
      console.warn(
        `autoTagCareEvent: upsert failed for event ${careEventId}: ${insertError.message}`,
      );
      return 0;
    }

    return count ?? matchingMedIds.length;
  } catch (err) {
    console.warn(`autoTagCareEvent: unexpected error`, err);
    return 0;
  }
}

export async function autoTagDocument(
  documentId: string,
  orgId: string,
  recipientId: string,
): Promise<number> {
  try {
    const { data: docData, error: docError } = await supabaseAdmin
      .from("documents")
      .select("extracted_text")
      .eq("id", documentId)
      .single();

    if (docError || !docData) {
      console.warn(
        `autoTagDocument: failed to fetch document ${documentId}: ${docError?.message}`,
      );
      return 0;
    }

    const extractedText = (docData.extracted_text as string | null) ?? "";
    // PHI rule: never log extracted_text contents
    const searchText = extractedText.toLowerCase();

    const { data: meds, error: medsError } = await supabaseAdmin
      .from("medications")
      .select("id, drug_name, brand_name")
      .eq("org_id", orgId)
      .eq("recipient_id", recipientId)
      .eq("active", true);

    if (medsError || !meds) {
      console.warn(
        `autoTagDocument: failed to fetch medications for org ${orgId}: ${medsError?.message}`,
      );
      return 0;
    }

    const matchingMedIds: string[] = [];
    for (const med of meds) {
      const terms = [med.drug_name, med.brand_name]
        .filter((s): s is string => Boolean(s))
        .map((s) => s.toLowerCase());
      if (terms.some((term) => searchText.includes(term))) {
        matchingMedIds.push(med.id as string);
      }
    }

    if (matchingMedIds.length === 0) return 0;

    const rows = matchingMedIds.map((medicationId) => ({
      document_id: documentId,
      medication_id: medicationId,
      org_id: orgId,
      confidence: "auto" as const,
      tagged_by: null,
    }));

    const { error: insertError, count } = await supabaseAdmin
      .from("document_medications")
      .upsert(rows, { ignoreDuplicates: true, count: "exact" });

    if (insertError) {
      console.warn(
        `autoTagDocument: upsert failed for document ${documentId}: ${insertError.message}`,
      );
      return 0;
    }

    return count ?? matchingMedIds.length;
  } catch (err) {
    console.warn(`autoTagDocument: unexpected error`, err);
    return 0;
  }
}

// ── Cross-reference queries ────────────────────────────────────────────────────

export async function listEventsForMedication(
  medicationId: string,
  limit = 5,
): Promise<
  Array<{
    id: string;
    occurred_at: string;
    event_type: string;
    payload: Record<string, unknown>;
  }>
> {
  const { data, error } = await supabaseAdmin
    .from("care_event_medications")
    .select("care_events(id, occurred_at, event_type, payload)")
    .eq("medication_id", medicationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => row.care_events as unknown)
    .filter(
      (
        e,
      ): e is {
        id: string;
        occurred_at: string;
        event_type: string;
        payload: Record<string, unknown>;
      } => Boolean(e),
    );
}

export async function listDocumentsForMedication(medicationId: string): Promise<
  Array<{
    id: string;
    display_name: string;
    doc_type: string;
    created_at: string;
  }>
> {
  const { data, error } = await supabaseAdmin
    .from("document_medications")
    .select("documents(id, display_name, doc_type, created_at)")
    .eq("medication_id", medicationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => row.documents as unknown)
    .filter(
      (
        d,
      ): d is {
        id: string;
        display_name: string;
        doc_type: string;
        created_at: string;
      } => Boolean(d),
    );
}
