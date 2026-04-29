// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://b7f31415e84a995296f5f019cc3fff26@o4511181211369472.ingest.us.sentry.io/4511192928157696",

  // Replay integration is intentionally absent. Both sample rates are 0 (PHI
  // protection — DOM contents could include care data), so the integration is
  // dead code that bloats the shared chunk on every route, including marketing.

  tracesSampleRate: 1,
  enableLogs: true,

  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // PHI protection: never send PII to Sentry. Identify users by UUID only.
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// posthog.init() lives in <PostHogInit /> — mounted only on routes that capture
// events (authed app, signin, onboarding, brief). Marketing routes don't load
// posthog-js at all.
