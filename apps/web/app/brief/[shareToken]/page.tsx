"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { Heart } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { BriefEditorial, type Brief } from "./BriefEditorial";

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
    posthog.capture("daily_brief_viewed");
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
    const message =
      error === "This care brief is no longer available."
        ? "This care brief link has expired or been revoked."
        : (error ?? "This care brief link has expired or been revoked.");
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
        <main className="w-full max-w-sm">
          <Card className="shadow-sm gap-2">
            <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <Heart
                  className="w-4 h-4 text-[var(--color-primary)]"
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold text-[var(--color-ink)]">
                  CareSync
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-4 pb-6 text-center space-y-3">
              <p className="text-base font-medium text-[var(--color-ink)]">
                {message}
              </p>
              <p className="text-sm text-[var(--color-muted)]">
                Care briefs are private snapshots and may expire after a set
                period for the family&apos;s privacy.
              </p>
              <Link
                href="/"
                className="inline-block mt-2 text-sm font-medium text-[var(--color-primary)] underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded-sm"
              >
                Visit CareSync
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

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
          .page-content article {
            max-width: none;
          }
        }
      `}</style>
      <BriefEditorial brief={brief} />
    </>
  );
}
