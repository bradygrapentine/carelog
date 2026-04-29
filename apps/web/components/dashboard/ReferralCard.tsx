"use client";

import { useState, useCallback } from "react";
import { CardContent } from "@/components/ui/card";
import { TintedCard, TintedCardHeader } from "@/components/ui/tinted-card";

/** Derive a URL-safe org slug: first 8 chars of name lowercased, falling back to org id. */
function deriveOrgSlug(org: { id: string; name: string }): string {
  const namePart = org.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);
  return namePart.length >= 3 ? namePart : org.id;
}

type ReferralCardProps = {
  org: { id: string; name: string };
  userId: string;
};

export function ReferralCard({ org, userId }: ReferralCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const slug = deriveOrgSlug(org);
    const url = `${window.location.origin}/signup?ref=${slug}`;

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for environments where clipboard API is unavailable
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }

    // Fire server-side PostHog event — UUID only, no PII
    void fetch("/api/referral/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orgId: org.id, userId }),
    });

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [org, userId]);

  return (
    <TintedCard>
      <TintedCardHeader title="Refer a family" />
      <CardContent className="pt-4 pb-4 px-4">
        <p className="text-sm text-muted-foreground mb-4">
          Know another family who could use coordination support? Share CareSync
          with them.
        </p>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy referral link to clipboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 min-h-[40px]"
        >
          {copied ? "Copied!" : "Copy referral link"}
        </button>
      </CardContent>
    </TintedCard>
  );
}
