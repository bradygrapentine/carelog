"use client";

import { useEffect, useMemo, useState } from "react";
import { trpc } from "../../../../lib/trpc";
import { authenticatedFetch } from "../../../../lib/authenticatedFetch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/EmptyState";
import { FolderOpen } from "lucide-react";
import { MedicationChipBar } from "@/components/medications/MedicationChipBar";

type Props = {
  orgId: string;
  recipientId: string;
  currentUserRole: string;
  medications?: Array<{ id: string; drug_name: string; brand_name: string | null }>;
};

type DocRow = {
  id: string;
  display_name: string;
  doc_type: string;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
  match_snippet?: string | null;
};

const DOC_TYPE_OPTS = [
  { value: "hipaa_authorization", label: "HIPAA Authorization" },
  { value: "power_of_attorney", label: "Power of Attorney" },
  { value: "advance_directive", label: "Advance Directive" },
  { value: "insurance_card", label: "Insurance Card" },
  { value: "medication_list", label: "Medication List" },
  { value: "other", label: "Other" },
] as const;

const DOC_TYPE_COLORS: Record<string, string> = {
  hipaa_authorization: "bg-purple-100 text-purple-700",
  power_of_attorney: "bg-amber-100 text-amber-700",
  advance_directive: "bg-red-100 text-red-700",
  insurance_card: "bg-[var(--color-primary-subtle)] text-primary",
  medication_list: "bg-green-100 text-green-700",
  other: "bg-[var(--color-surface)] text-foreground/80",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function DocumentVault({
  orgId,
  recipientId,
  currentUserRole,
  medications,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [docType, setDocType] = useState("other");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedMedId, setSelectedMedId] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const isCoordinator = currentUserRole === "coordinator";

  const utils = trpc.useUtils();

  const { data: docs = [], isLoading } = trpc.documents.list.useQuery({
    org_id: orgId,
    recipient_id: recipientId,
    q: debouncedSearch || undefined,
  });

  const { data: taggedDocIds } =
    trpc.medications.getDocumentIdsForMedication.useQuery(
      { medication_id: selectedMedId! },
      { enabled: !!selectedMedId },
    );

  const taggedDocSet = useMemo(
    () => new Set(taggedDocIds ?? []),
    [taggedDocIds],
  );

  const filteredDocs = docs.filter((d) => {
    if (selectedMedId && !taggedDocSet.has(d.id)) return false;
    return true;
  });

  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => utils.documents.list.invalidate(),
  });

  async function handleUpload(e: React.FormEvent) {
    const form = e.currentTarget as HTMLFormElement;
    e.preventDefault();
    const displayNameEl = form.elements.namedItem(
      "displayName",
    ) as HTMLInputElement;
    const docTypeEl = form.elements.namedItem("docType") as HTMLSelectElement;
    const fileEl = form.elements.namedItem("file") as HTMLInputElement;
    const displayName = displayNameEl.value;
    const docTypeVal = docTypeEl.value;
    const file = fileEl.files?.[0];

    if (!file || !displayName) {
      setUploadError("Please provide a file and a display name.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("orgId", orgId);
      formData.append("recipientId", recipientId);
      formData.append("displayName", displayName);
      formData.append("docType", docTypeVal);
      formData.append("file", file);

      const res = await authenticatedFetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setUploadError(data.error ?? "Upload failed.");
        return;
      }

      utils.documents.list.invalidate();
      form.reset();
      setDocType("other");
    } finally {
      setUploading(false);
    }
  }

  function handleDownload(docId: string) {
    const url = "/api/documents/" + docId + "/download";
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="w-full px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground/80">
          Document vault
        </span>
      </div>

      <div className="px-4 pb-4 border-t border-border space-y-4">
        <MedicationChipBar
          medications={medications ?? []}
          selected={selectedMedId}
          onSelect={setSelectedMedId}
        />
        {isLoading && (
          <p className="text-sm text-muted-foreground pt-3">Loading...</p>
        )}

        {!isLoading && docs.length === 0 && (
          <EmptyState
            icon={FolderOpen}
            title="No documents uploaded"
            description="Store medical records, legal documents, and important files in one secure place."
          />
        )}

        {!isLoading && docs.length > 0 && (
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents by name…"
            aria-label="Search documents"
            className="w-full text-sm"
          />
        )}

        {!isLoading && docs.length > 0 && filteredDocs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No documents match your search.
          </p>
        )}

        {!isLoading && filteredDocs.length > 0 && (
          <ul className="divide-y divide-border pt-2">
            {filteredDocs.map((doc: DocRow) => {
              const colorClass =
                DOC_TYPE_COLORS[doc.doc_type] ??
                "bg-[var(--color-surface)] text-foreground/80";
              const sizeLabel = formatBytes(doc.file_size);
              const dateLabel = new Date(doc.created_at).toLocaleDateString();
              const metaLabel = sizeLabel
                ? dateLabel + " · " + sizeLabel
                : dateLabel;
              const downloadAriaLabel = "Download " + doc.display_name;
              const deleteAriaLabel = "Delete " + doc.display_name;
              return (
                <li
                  key={doc.id}
                  className="py-2 flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={
                          "text-xs px-2 py-0.5 rounded-full font-medium " +
                          colorClass
                        }
                      >
                        {doc.doc_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-sm font-medium text-foreground truncate">
                        {doc.display_name}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {metaLabel}
                    </p>
                    {doc.match_snippet && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        matched in content: &ldquo;{doc.match_snippet}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDownload(doc.id)}
                      className="text-xs text-primary hover:underline"
                      aria-label={downloadAriaLabel}
                    >
                      Download
                    </button>
                    {isCoordinator && (
                      <button
                        type="button"
                        onClick={() =>
                          deleteMutation.mutate({ id: doc.id, org_id: orgId })
                        }
                        className="text-muted-foreground hover:text-[var(--color-danger)] transition-colors"
                        aria-label={deleteAriaLabel}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {isCoordinator && (
          <form
            onSubmit={handleUpload}
            className="space-y-2 pt-2 border-t border-border"
          >
            <p className="text-xs font-medium text-muted-foreground">
              Upload document
            </p>
            {uploadError && (
              <p className="text-xs text-[var(--color-danger)]">
                {uploadError}
              </p>
            )}
            <Input
              name="displayName"
              type="text"
              placeholder="Display name (e.g. Mom's POA)"
              required
              className="w-full text-sm"
            />
            <select
              name="docType"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {DOC_TYPE_OPTS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              name="file"
              type="file"
              required
              className="w-full text-sm text-foreground/80"
            />
            <Button
              type="submit"
              disabled={uploading}
              className="w-full"
              size="sm"
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
