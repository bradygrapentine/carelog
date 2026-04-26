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
} else {
  // No api key (CI, local-dev without analytics): init in opted-out mode so
  // posthog.capture() / .identify() are safe no-ops instead of throwing
  // "You must pass your PostHog project's api key" — which previously aborted
  // form-submit handlers (sign-in, onboarding) before their router.replace()
  // call, hanging E2E tests on /signin and /onboarding.
  posthog.init("phc_e2e_stub", {
    api_host: "/ingest",
    autocapture: false,
    capture_pageview: false,
    capture_exceptions: false,
    disable_session_recording: true,
    loaded: (ph) => ph.opt_out_capturing(),
  });
}
