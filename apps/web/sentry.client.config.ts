// This file configures Sentry on the client (browser).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://b7f31415e84a995296f5f019cc3fff26@o4511181211369472.ingest.us.sentry.io/4511192928157696",

  // TD-125: gate event-sending in dev so the local Hobby-tier free quota
  // doesn't 429 on every page load. Set SENTRY_FORCE_ENABLED=true to debug
  // Sentry locally. Sentry.init STAYS called so instrumentation references
  // (captureRequestError, captureRouterTransitionStart) wire correctly.
  enabled:
    process.env.NODE_ENV === "production" ||
    process.env.SENTRY_FORCE_ENABLED === "true",

  tracesSampleRate: 1,

  // PHI protection: never send PII to Sentry. Identify users by UUID only.
  sendDefaultPii: false,

  // Replay is disabled — it could capture sensitive care data in the DOM.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
