"use client";

/**
 * /visit-summary — Print-friendly visit summary (UX-20)
 *
 * Authenticated client route. Fetches the last 28 days of care data using the
 * browser Supabase client (RLS-scoped) and renders a printable summary.
 * No new API route or server component needed — data is fetched client-side
 * just like DashboardClient.tsx. Browser print dialog is triggered via
 * window.print().
 *
 * Print CSS: hide nav/sidebar/footer, force white background. Defined in the
 * JSX via Tailwind's `print:` variant and a <style> tag for @media print rules
 * that can't be expressed with utilities alone.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Printer, ArrowLeft } from "lucide-react";
import { VisitSummary, type VisitSummaryProps } from "@/components/VisitSummary";
import { Skeleton } from "@/components/ui/skeleton";

type LoadedData = {
  recipient: VisitSummaryProps["recipient"];
  medications: VisitSummaryProps["medications"];
  doseEvents: VisitSummaryProps["doseEvents"];
  symptomReadings: VisitSummaryProps["symptomReadings"];
  journalEntries: VisitSummaryProps["journalEntries"];
};

export default function VisitSummaryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const questions = searchParams.get("questions") ?? "";

  const [data, setData] = useState<LoadedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      try {
        // 1. Auth check
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/signin");
          return;
        }

        // 2. Resolve org + recipient (first accepted membership)
        const { data: membership } = await supabase
          .from("memberships")
          .select("org_id, recipient_id")
          .eq("user_id", user.id)
          .not("accepted_at", "is", null)
          .limit(1)
          .maybeSingle();

        if (!membership) {
          setError("No care team found. Set one up to generate a visit summary.");
          setLoading(false);
          return;
        }

        const { org_id: orgId, recipient_id: recipientId } = membership;

        // 3. Resolve recipient PHI via identity_vault
        // RLS on identity_vault allows coordinators to read via identity_token join.
        const { data: recipientRow } = await supabase
          .from("care_recipients")
          .select("identity_token")
          .eq("id", recipientId)
          .eq("org_id", orgId)
          .maybeSingle();

        let recipientName = "Care Recipient";
        let recipientDob: string | null = null;

        if (recipientRow?.identity_token) {
          const { data: vault } = await supabase
            .from("identity_vault")
            .select("full_name, dob")
            .eq("token", recipientRow.identity_token)
            .maybeSingle();

          if (vault) {
            recipientName = vault.full_name ?? "Care Recipient";
            recipientDob = vault.dob ?? null;
          }
        }

        // 4. Compute 28-day window
        const since = new Date(
          Date.now() - 28 * 24 * 60 * 60 * 1000,
        ).toISOString();

        // 5. Parallel data fetch
        const [medsRes, eventsRes, symptomsRes] = await Promise.all([
          supabase
            .from("medications")
            .select(
              "id, drug_name, dosage, form, instructions, prescriber, active",
            )
            .eq("org_id", orgId)
            .eq("recipient_id", recipientId)
            .eq("active", true),

          supabase
            .from("care_events")
            .select(
              "id, event_type, entry_kind, occurred_at, flagged, payload, recipient_id",
            )
            .eq("org_id", orgId)
            .eq("recipient_id", recipientId)
            .gte("occurred_at", since)
            .order("occurred_at", { ascending: false })
            .limit(500),

          supabase
            .from("symptom_readings")
            .select(
              "id, pain_level, mood, appetite, mobility, notes, recorded_at",
            )
            .eq("org_id", orgId)
            .eq("recipient_id", recipientId)
            .gte("recorded_at", since)
            .order("recorded_at", { ascending: false })
            .limit(200),
        ]);

        const allEvents = (eventsRes.data ?? []) as VisitSummaryProps["doseEvents"];

        // Dose events are care_events with event_type = 'medication_dose'
        const doseEvents = allEvents.filter(
          (e) => e.event_type === "medication_dose",
        );

        // Journal highlights: journal entry_kind, sorted by flagged + recency
        const journalEntries = allEvents.filter(
          (e) => e.entry_kind === "journal" || e.event_type === "journal",
        ) as VisitSummaryProps["journalEntries"];

        setData({
          recipient: { name: recipientName, dob: recipientDob },
          medications: (medsRes.data ?? []) as VisitSummaryProps["medications"],
          doseEvents,
          symptomReadings: (symptomsRes.data ??
            []) as VisitSummaryProps["symptomReadings"],
          journalEntries,
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <>
      {/* Print CSS: hide everything except the summary article */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          nav, header, footer, aside { display: none !important; }
          .visit-summary { max-width: 100% !important; }
          section { page-break-inside: avoid; }
        }
      `}</style>

      {/* ── Toolbar (hidden on print) ── */}
      <div
        className="no-print sticky top-0 z-10 bg-white border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between max-w-[720px] mx-auto print:hidden"
        aria-label="Visit summary toolbar"
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded min-h-[40px] px-2"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back
        </button>

        <button
          type="button"
          onClick={handlePrint}
          disabled={loading || !!error}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-primary-subtle)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px]"
          aria-label="Print visit summary"
        >
          <Printer className="w-4 h-4" aria-hidden="true" />
          Print
        </button>
      </div>

      {/* ── Content ── */}
      <main className="min-h-screen bg-[var(--color-surface)] print:bg-white">
        {loading ? (
          <div className="max-w-[720px] mx-auto px-8 py-10 space-y-6">
            <Skeleton className="h-8 w-48 rounded" />
            <Skeleton className="h-4 w-64 rounded" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        ) : error ? (
          <div className="max-w-[720px] mx-auto px-8 py-10">
            <p className="text-[var(--color-danger)] text-sm">{error}</p>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mt-4 text-sm text-[var(--color-primary)] underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded"
            >
              Go to Dashboard
            </button>
          </div>
        ) : data ? (
          <VisitSummary
            recipient={data.recipient}
            medications={data.medications}
            doseEvents={data.doseEvents}
            symptomReadings={data.symptomReadings}
            journalEntries={data.journalEntries}
            questions={questions}
            generatedAt={new Date().toISOString()}
          />
        ) : null}
      </main>
    </>
  );
}
