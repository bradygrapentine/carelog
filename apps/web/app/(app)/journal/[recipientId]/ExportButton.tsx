"use client";

import { useState } from "react";
import { toast } from "sonner";
import { authenticatedFetch } from "../../../../lib/authenticatedFetch";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import posthog from "posthog-js";

type Props = {
  orgId: string;
  recipientId: string;
  currentUserRole: string;
};

type Format = "json" | "pdf";

export function ExportButton({ orgId, recipientId, currentUserRole }: Props) {
  const [format, setFormat] = useState<Format>("json");
  const [since, setSince] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Server enforces coordinator-only; hide component for other roles
  if (currentUserRole !== "coordinator") return null;

  async function runDownload(fmt: Format, sinceValue: string) {
    setLoading(true);
    setError(null);

    const body: Record<string, string> = { orgId, recipientId, format: fmt };
    if (sinceValue) body.since = new Date(sinceValue).toISOString();

    const res = await authenticatedFetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setError(
        "The export didn't finish. Try again, or pick a smaller date range.",
      );
      setLoading(false);
      return;
    }

    try {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fmt === "json" ? "care-history.json" : "care-history.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      posthog.capture("care_history_exported", {
        format: fmt,
        has_date_filter: !!sinceValue,
      });
    } catch {
      setError(
        "The export didn't finish. Try again, or pick a smaller date range.",
      );
      toast.error(
        "The export didn't finish. Try again, or pick a smaller date range.",
        {
          action: {
            label: "Try again",
            onClick: () => runDownload(fmt, sinceValue),
          },
        },
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(e: React.FormEvent) {
    e.preventDefault();
    await runDownload(format, since);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Export full history</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleDownload} className="space-y-3">
          {/* Format */}
          <fieldset>
            <legend className="text-xs font-medium text-foreground/80 mb-1.5">
              Format
            </legend>
            <div className="flex gap-2">
              {(["json", "pdf"] as Format[]).map((f) => {
                const isSelected = format === f;
                const cls =
                  "px-3 py-1.5 text-xs font-medium rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-ring " +
                  (isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-border/80");
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={cls}
                    aria-pressed={isSelected}
                  >
                    {f.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Date range */}
          <div>
            <label
              htmlFor="export-since"
              className="block text-xs font-medium text-foreground/80 mb-1"
            >
              From date{" "}
              <span className="font-normal text-muted-foreground">
                (optional — exports all history if empty)
              </span>
            </label>
            <Input
              id="export-since"
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-[var(--color-danger)]" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "Preparing..." : "Download export"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
