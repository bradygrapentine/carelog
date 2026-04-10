"use client";

import { useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "../../../lib/authenticatedFetch";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type ParsedPayload = {
  drug_name: string;
  dosage: string | null;
  instructions: string | null;
};

type OcrJob = {
  id: string;
  recipient_id: string;
  image_url: string;
  raw_text: string | null;
  parsed_payload: ParsedPayload | null;
  created_at: string;
};

type Props = {
  orgId: string;
  recipientId: string;
};

export function OcrReviewPanel({ orgId, recipientId }: Props) {
  const [jobs, setJobs] = useState<OcrJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, ParsedPayload>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reviewUrl = "/api/ocr/review?orgId=" + orgId;

  async function loadJobs() {
    setLoading(true);
    try {
      const res = await authenticatedFetch(reviewUrl);
      const data = await res.json();
      const fetchedJobs: OcrJob[] = data.jobs ?? [];
      setJobs(fetchedJobs);
      // Initialise editable fields from parsed_payload
      const initial: Record<string, ParsedPayload> = {};
      for (const j of fetchedJobs) {
        initial[j.id] = {
          drug_name: j.parsed_payload?.drug_name ?? "",
          dosage: j.parsed_payload?.dosage ?? "",
          instructions: j.parsed_payload?.instructions ?? "",
        };
      }
      setEdits(initial);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
  }, [orgId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("orgId", orgId);
      fd.append("recipientId", recipientId);
      const res = await authenticatedFetch("/api/ocr/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.jobId) {
        setUploadMsg("Scan submitted for review.");
      } else {
        setUploadMsg("Upload failed: " + (data.error ?? "Unknown error"));
      }
    } catch {
      setUploadMsg("Upload failed.");
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleConfirm(job: OcrJob) {
    const edit = edits[job.id];
    if (!edit) return;
    const res = await authenticatedFetch("/api/ocr/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: job.id,
        orgId,
        recipientId: job.recipient_id,
        drug_name: edit.drug_name,
        dosage: edit.dosage ?? "",
        instructions: edit.instructions ?? undefined,
      }),
    });
    if (res.ok) {
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
    }
  }

  async function handleDiscard(jobId: string) {
    const res = await authenticatedFetch("/api/ocr/discard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, orgId }),
    });
    if (res.ok) {
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    }
  }

  function setField(jobId: string, field: keyof ParsedPayload, value: string) {
    setEdits((prev) => ({
      ...prev,
      [jobId]: { ...prev[jobId], [field]: value },
    }));
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Scan prescription label</CardTitle>
          <div className="flex items-center gap-2">
            {uploading && (
              <span className="text-xs text-gray-400">Processing...</span>
            )}
            {uploadMsg && !uploading && (
              <span className="text-xs text-gray-500">{uploadMsg}</span>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              Scan label
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading && <p className="text-sm text-gray-400">Loading...</p>}

        {!loading && jobs.length === 0 && (
          <p className="text-sm text-gray-400">No scans pending review.</p>
        )}

        {jobs.map((job) => {
          const edit = edits[job.id] ?? {
            drug_name: "",
            dosage: "",
            instructions: "",
          };
          return (
            <div
              key={job.id}
              className="mb-4 pb-4 border-b border-gray-50 last:border-0"
            >
              <p className="text-xs text-gray-400 mb-2">
                Scanned {new Date(job.created_at).toLocaleDateString()}
              </p>

              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Drug name
                  </label>
                  <input
                    type="text"
                    value={edit.drug_name}
                    onChange={(e) =>
                      setField(job.id, "drug_name", e.target.value)
                    }
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Dosage
                  </label>
                  <input
                    type="text"
                    value={edit.dosage ?? ""}
                    onChange={(e) => setField(job.id, "dosage", e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Instructions
                  </label>
                  <input
                    type="text"
                    value={edit.instructions ?? ""}
                    onChange={(e) =>
                      setField(job.id, "instructions", e.target.value)
                    }
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => handleConfirm(job)}
                  disabled={!edit.drug_name || !edit.dosage}
                  className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => handleDiscard(job.id)}
                  className="text-sm text-red-400 hover:text-red-600 transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
