// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// TD-192: Sentry cause-hygiene.
// Repository throws use the `new Error("<stable_code>", { cause: pgError })`
// pattern (TD-178/TD-192). The raw Postgres error on `.cause` can carry column
// values in its `detail`/`message` (e.g. `Key (email)=(jane@x.com)`) — that's
// PHI. Default serialization may walk `cause` into the captured event, so we
// scrub it in `beforeSend` BEFORE anything leaves the process.
//
// Scope: only `cause` objects are touched — the top-level (stable-code) message
// and the rest of the event are left intact. Pure + exported so the sentinel
// test can assert no PHI fragment survives without booting Sentry.
export function scrubCausePhi<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  if (seen.has(obj)) return value;
  seen.add(obj);

  for (const key of Object.keys(obj)) {
    const child = obj[key];
    if (key === "cause" && child !== null && typeof child === "object") {
      const cause = child as Record<string, unknown>;
      // Drop the PHI-bearing fields outright; keep structural signal (code).
      delete cause.detail;
      delete cause.hint;
      delete cause.where;
      if (typeof cause.message === "string") cause.message = "[redacted]";
      scrubCausePhi(cause, seen);
    } else {
      scrubCausePhi(child, seen);
    }
  }
  return value;
}

// Generic so it slots into Sentry's `beforeSend` signature without depending on
// a named event-type re-export. The arrow at the call site guarantees only the
// event reaches the recursion (never the EventHint second arg).
export function scrubSentryEvent<T>(event: T): T {
  return scrubCausePhi(event);
}

Sentry.init({
  beforeSend: (event) => scrubSentryEvent(event),

  dsn: "https://b7f31415e84a995296f5f019cc3fff26@o4511181211369472.ingest.us.sentry.io/4511192928157696",

  // TD-125: gate event-sending in dev. See sentry.client.config.ts for rationale.
  enabled:
    process.env.NODE_ENV === "production" ||
    process.env.SENTRY_FORCE_ENABLED === "true",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // PHI protection: never send PII to Sentry. The identity vault ensures only
  // UUIDs reach error reports, but this adds a second layer of defence.
  sendDefaultPii: false,
});
