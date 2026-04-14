import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

// Initialize Sentry exactly once. Silently no-ops when the DSN is unset
// (dev/test) so developers can run without any Sentry config.
export function initSentry(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    enableNativeCrashHandling: true,
    beforeSend(event) {
      // Belt-and-suspenders PII scrub — even though sendDefaultPii is false,
      // strip email / phone / name from breadcrumbs just in case a caregiver
      // accidentally pastes one into a form.
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }
      if (Array.isArray(event.breadcrumbs)) {
        for (const crumb of event.breadcrumbs) {
          if (crumb.data && typeof crumb.data === "object") {
            delete (crumb.data as Record<string, unknown>).email;
            delete (crumb.data as Record<string, unknown>).phone;
            delete (crumb.data as Record<string, unknown>).name;
          }
        }
      }
      return event;
    },
  });
}

export { Sentry };
