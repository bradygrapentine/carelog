"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

function BillingSuccessInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get("session_id") ?? null;
  const [status, setStatus] = useState<"loading" | "paid" | "error">("loading");
  const [interval, setInterval] = useState("month");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    fetch("/api/stripe/verify?session_id=" + sessionId)
      .then((res) => {
        if (!res.ok) throw new Error("verify failed");
        return res.json();
      })
      .then((data) => {
        if (data.status === "paid") {
          setStatus("paid");
          setInterval(data.interval);
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [sessionId]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[var(--color-muted)]">
          Confirming your subscription...
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-sm text-center">
          <CardHeader>
            <p className="text-lg font-bold text-[var(--color-ink)]">
              We couldn&apos;t confirm your subscription
            </p>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              Stripe didn&apos;t return a confirmation. If your card was
              charged, refresh in a minute — or email hello@care-log.org and
              we&apos;ll sort it out.
            </p>
            <a href="/dashboard" className={buttonVariants()}>
              Go to dashboard
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const planLabel = interval === "year" ? "$120/yr" : "$14/mo";

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-sm text-center">
        <CardHeader>
          <p className="text-2xl font-bold text-[var(--color-ink)]">
            Welcome to the Family Plan!
          </p>
        </CardHeader>
        <CardContent>
          <p className="mb-6 text-sm text-[var(--color-muted)]">
            Your subscription ({planLabel}) is active. Your entire care team now
            has full access.
          </p>
          <a href="/dashboard" className={buttonVariants()}>
            Go to dashboard
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-[var(--color-muted)]">
            Confirming your subscription...
          </p>
        </div>
      }
    >
      <BillingSuccessInner />
    </Suspense>
  );
}
