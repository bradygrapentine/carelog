"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

// Mounted on routes that actually capture events (authed app, signin,
// onboarding, brief). Marketing routes don't render this — they shed the
// posthog-js bundle entirely from the critical path.
export function PostHogInit() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (posthog.__loaded) return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: false,
      capture_exceptions: true,
      debug: process.env.NODE_ENV === "development",
    });

    // Defensive wrap: analytics must never throw into product UX. Unguarded
    // posthog.capture/identify in form handlers previously aborted submit
    // when the api key was missing, hanging E2E on /signin and /onboarding.
    const wrap = <T extends (...args: never[]) => unknown>(fn: T): T =>
      ((...args: Parameters<T>) => {
        try {
          return fn.apply(posthog, args);
        } catch {
          // analytics is best-effort, never load-bearing
        }
      }) as T;
    posthog.capture = wrap(posthog.capture.bind(posthog));
    posthog.identify = wrap(posthog.identify.bind(posthog));
  }, []);

  return null;
}
