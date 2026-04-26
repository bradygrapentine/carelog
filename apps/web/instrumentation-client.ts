// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://b7f31415e84a995296f5f019cc3fff26@o4511181211369472.ingest.us.sentry.io/4511192928157696",

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // PHI protection: Replay is disabled — it could capture sensitive care data in the DOM.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // PHI protection: never send PII to Sentry. Identify users by UUID only.
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

import posthog from "posthog-js";

if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // manual for App Router
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  });
}

// Defensive wrap: analytics must NEVER block product UX. Unguarded
// posthog.capture/identify calls in form handlers (SignInForm,
// OnboardingForm, etc.) previously threw "You must pass your PostHog
// project's api key" in CI (no env var), aborting the handler before
// router.replace() — hanging E2E on /signin and /onboarding. Wrapping
// at the SDK boundary fixes every call site at once and protects
// against any future posthog throw (network down, init race, etc.).
const wrap = <T extends (...args: never[]) => unknown>(fn: T): T =>
  ((...args: Parameters<T>) => {
    try {
      return fn.apply(posthog, args);
    } catch {
      // swallow — analytics is best-effort, never load-bearing
    }
  }) as T;
posthog.capture = wrap(posthog.capture.bind(posthog));
posthog.identify = wrap(posthog.identify.bind(posthog));
