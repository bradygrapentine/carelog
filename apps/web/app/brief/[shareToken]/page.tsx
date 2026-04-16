"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Medication = {
  drug_name: string;
  dosage: string | null;
  instructions: string | null;
};

type JournalEntry = {
  occurred_at: string;
  text: string | undefined;
  mood: string | undefined;
  flagged: boolean;
};

type BriefContent = {
  recipient_name: string;
  dob: string | null;
  generated_at: string;
  medications: Medication[];
  recent_entries: JournalEntry[];
};

type Brief = {
  id: string;
  title: string;
  content: BriefContent;
  includes: string[];
  created_at: string;
};

// pale badge bg tints — no token yet; see ON-48 for token pattern
const moodColors: Record<string, string> = {
  good: "#dcfce7",
  okay: "#fef9c3",
  difficult: "#fee2e2",
  crisis: "#fecdd3",
};

const moodLabels: Record<string, string> = {
  good: "Good",
  okay: "Okay",
  difficult: "Difficult",
  crisis: "Crisis",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function truncate(text: string | undefined, max: number) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export default function BriefPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setToken(p.shareToken));
  }, [params]);

  useEffect(() => {
    if (!token) return;
    posthog.capture("daily_brief_viewed", { share_token: token });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const url = "/api/brief/" + token;
    fetch(url)
      .then((res) => {
        if (res.status === 404 || res.status === 410) {
          setError("This care brief is no longer available.");
          setLoading(false);
          return null;
        }
        if (!res.ok) {
          setError("Unable to load care brief.");
          setLoading(false);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setBrief(data as Brief);
          setLoading(false);
        }
      })
      .catch(() => {
        setError("Unable to load care brief.");
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--color-ink)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
        <div className="max-w-md text-center p-8">
          <p className="text-[var(--color-muted)] text-base">
            {error ?? "This care brief is no longer available."}
          </p>
        </div>
      </div>
    );
  }

  const { content } = brief;
  const generatedDate = formatDate(content.generated_at);

  return (
    <>
      <style>{`
        @media print {
          body {
            background: white;
            color: var(--color-ink);
          }
          .print\\:hidden {
            display: none;
          }
          .page-content {
            max-width: none;
            padding: 0;
            background: white;
          }
          .page-content > .space-y-4 {
            gap: 1rem;
          }
          .page-content .shadow-sm {
            box-shadow: none;
          }
          .page-content .border {
            border-color: var(--color-ink);
          }
          .page-content [class^="bg-"] {
            break-inside: avoid;
          }
        }
      `}</style>
      <div className="min-h-screen bg-[var(--color-surface)] py-8 px-4 page-content">
        <div className="max-w-4xl mx-auto px-4 space-y-4">
          {/* Header card */}
          <Card className="shadow-sm gap-2">
            <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
              <CardTitle className="text-sm">{brief.title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-lg font-semibold text-[var(--color-ink)]">
                {content.recipient_name}
              </p>
              <p className="text-sm text-[var(--color-muted)] mt-1">
                Generated on {generatedDate}
              </p>
            </CardContent>
          </Card>

          {/* Medications */}
          {brief.includes.includes("medications") && (
            <Card className="shadow-sm gap-2">
              <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
                <CardTitle className="text-sm">Medications</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {content.medications.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">
                    No active medications recorded.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {content.medications.map((med, i) => (
                      <li
                        key={i}
                        className="p-3 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]"
                      >
                        <span className="font-semibold text-[var(--color-ink)]">
                          {med.drug_name}
                        </span>
                        {med.dosage && (
                          <span className="text-[var(--color-muted)] ml-2">
                            {med.dosage}
                          </span>
                        )}
                        {med.instructions && (
                          <p className="text-sm text-[var(--color-muted)] mt-1">
                            {med.instructions}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recent journal entries */}
          {brief.includes.includes("journal") && (
            <Card className="shadow-sm gap-2">
              <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
                <CardTitle className="text-sm">
                  Recent Journal Entries
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {content.recent_entries.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">
                    No recent journal entries.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {content.recent_entries.map((entry, i) => {
                      const moodBg = entry.mood
                        ? (moodColors[entry.mood] ?? "var(--color-surface)")
                        : undefined;
                      const moodLabel = entry.mood
                        ? (moodLabels[entry.mood] ?? entry.mood)
                        : undefined;
                      return (
                        <li
                          key={i}
                          className="p-3 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]"
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[0.8rem] text-[var(--color-muted)]">
                              {formatDate(entry.occurred_at)}
                            </span>
                            {moodLabel && (
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-medium text-[var(--color-text-secondary)]"
                                style={{ background: moodBg }}
                              >
                                {moodLabel}
                              </span>
                            )}
                          </div>
                          {entry.text && (
                            <p className="text-sm text-[var(--color-text-secondary)] m-0">
                              {truncate(entry.text, 140)}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {/* Footer */}
          <p className="text-xs text-[var(--color-muted)] text-center pt-2">
            This is a point-in-time snapshot generated by Carelog.
          </p>
        </div>
      </div>
    </>
  );
}
