"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!key) return; // no-op in local dev

    posthog.init(key, {
      api_host: host ?? "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: false, // manual for App Router
      // PHI protection: identify by Supabase UUID only — never email or name
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
