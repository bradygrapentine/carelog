"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  routeName: string;
};

export function RouteErrorBoundary({ error, reset, routeName }: Props) {
  useEffect(() => {
    // Surface to Sentry if available; do not include PHI in tags.
    console.error(`[${routeName}] route error:`, error);
  }, [error, routeName]);

  return (
    <div className="mx-auto max-w-xl p-4">
      <Card className="shadow-sm gap-2">
        <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
          <CardTitle className="text-sm">Something went wrong here</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            This page hit an error. You can try again, or head back to the
            dashboard.
          </p>
          {error.message && (
            <p className="text-xs text-[var(--color-muted)] font-mono break-all">
              {error.message}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button onClick={reset}>Try again</Button>
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Go to dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
