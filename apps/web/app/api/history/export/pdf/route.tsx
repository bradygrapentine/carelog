/* eslint-disable react-hooks/error-boundaries --
 * This file uses JSX as the @react-pdf/renderer DSL (synchronous PDF
 * generation), not React component instantiation. The rule's premise —
 * "React doesn't render immediately so try/catch won't catch errors" —
 * does not apply: renderToBuffer awaits synchronously and any thrown
 * errors are caught by the surrounding try/catch.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { buildHistoryExport } from "@/lib/buildHistoryExport";
import { formatLocaleDate, formatLocaleDateTime } from "@/lib/format";
import {
  renderToBuffer,
  Document,
  Page,
  Text,
  View,
} from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";
import { pdfTokens } from "@/lib/pdfTokens";

const requestSchema = z.object({
  org_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
});

// Styles for the PDF — basic, doctor-friendly layout
const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: pdfTokens.ink,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: pdfTokens.muted,
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: pdfTokens.border,
    paddingBottom: 3,
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
    gap: 8,
  },
  label: {
    fontFamily: "Helvetica-Bold",
    width: 100,
    flexShrink: 0,
  },
  value: {
    flex: 1,
    color: pdfTokens.neutral700,
  },
  eventItem: {
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: pdfTokens.neutral100,
  },
  eventDate: {
    fontSize: 8,
    color: pdfTokens.muted,
    marginBottom: 2,
  },
  eventText: {
    fontSize: 9,
    lineHeight: 1.4,
  },
  flagged: {
    color: pdfTokens.dangerLegacy,
    fontSize: 8,
    marginTop: 2,
  },
  noData: {
    color: pdfTokens.muted,
    fontStyle: "italic",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: pdfTokens.neutral400,
    textAlign: "center",
  },
});

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { org_id, recipient_id } = parsed.data;

    // Verify caller is coordinator for this org
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("memberships")
      .select("role, accepted_at")
      .eq("org_id", org_id)
      .eq("user_id", user.id)
      .single();

    if (
      membershipError ||
      !membership ||
      membership.role !== "coordinator" ||
      !membership.accepted_at
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build snapshot — de-tokenizes identity once
    const snapshot = await buildHistoryExport({
      orgId: org_id,
      recipientId: recipient_id,
      supabaseAdmin,
    });

    // Build PDF
    const pdfBuffer = await renderToBuffer(
      <Document title={`Care History — ${snapshot.recipient_name}`}>
        <Page size="A4" style={styles.page}>
          {/* Header */}
          <View>
            <Text style={styles.title}>Care History Export</Text>
            <Text style={styles.subtitle}>
              Generated {formatLocaleDateTime(snapshot.generated_at)} · Carelog
            </Text>
          </View>

          {/* Recipient info */}
          <Text style={styles.sectionHeader}>Recipient</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{snapshot.recipient_name}</Text>
          </View>
          {snapshot.dob && (
            <View style={styles.row}>
              <Text style={styles.label}>Date of birth</Text>
              <Text style={styles.value}>{snapshot.dob}</Text>
            </View>
          )}

          {/* Medications */}
          <Text style={styles.sectionHeader}>
            Medications ({snapshot.medications.length})
          </Text>
          {snapshot.medications.length === 0 ? (
            <Text style={styles.noData}>No medications recorded.</Text>
          ) : (
            snapshot.medications.map((med) => (
              <View key={med.id} style={styles.row}>
                <Text style={styles.label}>{med.drug_name}</Text>
                <Text style={styles.value}>
                  {[med.dosage, med.instructions].filter(Boolean).join(" — ") ||
                    "No details"}
                  {!med.active ? " (inactive)" : ""}
                </Text>
              </View>
            ))
          )}

          {/* Symptom readings */}
          <Text style={styles.sectionHeader}>
            Symptom Readings ({snapshot.symptom_readings.length})
          </Text>
          {snapshot.symptom_readings.length === 0 ? (
            <Text style={styles.noData}>No symptom readings recorded.</Text>
          ) : (
            snapshot.symptom_readings.map((sr) => (
              <View key={sr.id} style={styles.row}>
                <Text style={styles.label}>{sr.reading_type}</Text>
                <Text style={styles.value}>
                  {sr.value != null
                    ? `${sr.value}${sr.unit ? " " + sr.unit : ""}`
                    : "—"}
                  {sr.notes ? ` · ${sr.notes}` : ""}
                  {" · "}
                  {formatLocaleDate(sr.recorded_at)}
                </Text>
              </View>
            ))
          )}

          {/* Journal / care events */}
          <Text style={styles.sectionHeader}>
            Journal &amp; Care Events ({snapshot.care_events.length})
          </Text>
          {snapshot.care_events.length === 0 ? (
            <Text style={styles.noData}>No care events recorded.</Text>
          ) : (
            snapshot.care_events.map((ev) => (
              <View key={ev.id} style={styles.eventItem}>
                <Text style={styles.eventDate}>
                  {formatLocaleDateTime(ev.occurred_at)} · {ev.event_type}
                  {ev.entry_kind ? ` (${ev.entry_kind})` : ""}
                </Text>
                {ev.payload &&
                  "text" in ev.payload &&
                  typeof ev.payload.text === "string" &&
                  ev.payload.text.length > 0 && (
                    <Text style={styles.eventText}>{ev.payload.text}</Text>
                  )}
                {ev.flagged && (
                  <Text style={styles.flagged}>⚑ Flagged for follow-up</Text>
                )}
              </View>
            ))
          )}

          {/* EOL plan */}
          {snapshot.eol_plan && (
            <>
              <Text style={styles.sectionHeader}>End-of-Life Plan</Text>
              <Text style={styles.value}>
                Plan on file. Updated:{" "}
                {snapshot.eol_plan.updated_at
                  ? formatLocaleDate(snapshot.eol_plan.updated_at)
                  : formatLocaleDate(snapshot.eol_plan.created_at)}
              </Text>
            </>
          )}

          {/* Documents */}
          <Text style={styles.sectionHeader}>
            Documents ({snapshot.documents_metadata.length})
          </Text>
          {snapshot.documents_metadata.length === 0 ? (
            <Text style={styles.noData}>No documents on file.</Text>
          ) : (
            snapshot.documents_metadata.map((doc) => (
              <View key={doc.id} style={styles.row}>
                <Text style={styles.label}>{doc.file_name ?? "Unnamed"}</Text>
                <Text style={styles.value}>
                  {doc.file_type ?? "Unknown type"} ·{" "}
                  {formatLocaleDate(doc.created_at)}
                </Text>
              </View>
            ))
          )}

          {/* Footer */}
          <Text style={styles.footer}>
            Carelog · Confidential — for authorized care team use only ·
            Recipient ID: {recipient_id}
          </Text>
        </Page>
      </Document>,
    );

    const fileName = `care-history-${snapshot.recipient_name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(pdfBuffer.byteLength),
      },
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "An unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
