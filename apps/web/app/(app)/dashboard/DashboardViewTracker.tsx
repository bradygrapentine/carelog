"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export function DashboardViewTracker({ orgId }: { orgId?: string }) {
  useEffect(() => {
    posthog.capture("dashboard_viewed", { org_id: orgId });
  }, [orgId]);
  return null;
}
