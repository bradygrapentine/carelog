// This file configures Sentry on the client (browser).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://b7f31415e84a995296f5f019cc3fff26@o4511181211369472.ingest.us.sentry.io/4511192928157696",

  tracesSampleRate: 1,

  // PHI protection: never send PII to Sentry. Identify users by UUID only.
  sendDefaultPii: false,

  // Replay is disabled — it could capture sensitive care data in the DOM.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
