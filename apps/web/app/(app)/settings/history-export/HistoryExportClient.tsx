"use client";

import { useState } from "react";
import { trpc } from "../../../../lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileJson, FileText, Loader2 } from "lucide-react";

type Props = {
  orgId: string;
  recipientId: string;
};

export function HistoryExportClient({ orgId, recipientId }: Props) {
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const {
    data: preview,
    isLoading: previewLoading,
    error: previewError,
  } = trpc.historyExport.preview.useQuery(
    { org_id: orgId, recipient_id: recipientId },
    { enabled: Boolean(orgId && recipientId) },
  );

  const generateMutation = trpc.historyExport.generate.useMutation();

  async function handleDownloadJson() {
    setJsonError(null);
    try {
      const result = await generateMutation.mutateAsync({
        org_id: orgId,
        recipient_id: recipientId,
      });
      const blob = new Blob([JSON.stringify(result.snapshot, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `care-history-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setJsonError(
        err instanceof Error ? err.message : "Export failed. Please try again.",
      );
    }
  }

  async function handleDownloadPdf() {
    setPdfError(null);
    setPdfLoading(true);
    try {
      const res = await fetch("/api/history/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, recipient_id: recipientId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="?([^"]+)"?/);
      a.download =
        match?.[1] ??
        `care-history-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(
        err instanceof Error
          ? err.message
          : "PDF export failed. Please try again.",
      );
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <Card className="shadow-sm gap-2">
      <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
        <CardTitle className="text-sm">Export care history</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 flex flex-col gap-4">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Download a complete copy of all care records — journal entries,
          medications, symptom readings, and more. Formatted for sharing with a
          doctor or new care facility.
        </p>

        {/* Preview counts */}
        {previewLoading && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading export preview…
          </div>
        )}

        {previewError && (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {previewError.message}
          </p>
        )}

        {preview && (
          <div
            aria-label="Export contents summary"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm"
          >
            <p className="font-medium text-[var(--color-ink)] mb-2">
              This export will include:
            </p>
            <ul className="space-y-1 text-[var(--color-text-secondary)]">
              <li>
                <span className="font-medium text-[var(--color-ink)]">
                  {preview.care_events}
                </span>{" "}
                journal &amp; care events
              </li>
              <li>
                <span className="font-medium text-[var(--color-ink)]">
                  {preview.medications}
                </span>{" "}
                medications
              </li>
              <li>
                <span className="font-medium text-[var(--color-ink)]">
                  {preview.symptom_readings}
                </span>{" "}
                symptom readings
              </li>
              <li>
                <span className="font-medium text-[var(--color-ink)]">
                  {preview.documents_metadata}
                </span>{" "}
                document records
              </li>
              {preview.eol_plan && <li>End-of-life plan</li>}
            </ul>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            type="button"
            onClick={handleDownloadJson}
            disabled={generateMutation.isPending || previewLoading}
            aria-label="Download JSON export"
            className="flex items-center gap-2 bg-[var(--color-primary)] text-white hover:opacity-90 focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileJson className="h-4 w-4" aria-hidden="true" />
            )}
            Download JSON
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={pdfLoading || previewLoading}
            aria-label="Download PDF export"
            className="flex items-center gap-2 border-[var(--color-border)] text-[var(--color-ink)] hover:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            {pdfLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileText className="h-4 w-4" aria-hidden="true" />
            )}
            Download PDF
          </Button>
        </div>

        {/* Error states */}
        {jsonError && (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            JSON export error: {jsonError}
          </p>
        )}
        {pdfError && (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            PDF export error: {pdfError}
          </p>
        )}

        <p className="text-xs text-[var(--color-muted)]">
          Only coordinators can export care history. The export includes all
          records up to this moment — generate a new export for the latest data.
        </p>
      </CardContent>
    </Card>
  );
}
