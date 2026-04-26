import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

// Minimal PostHog stub used when NEXT_PUBLIC_POSTHOG_KEY is unset (CI, local
// dev without analytics). Constructing real `new PostHog(undefined)` throws
// "You must pass your PostHog project's api key", which previously surfaced
// as a 500 from every API route that captured an event — including
// /api/onboarding/create, hanging E2E on the onboarding page.
function noopPostHog(): PostHog {
  return {
    capture: () => {},
    identify: () => {},
    shutdown: async () => {},
    flush: async () => {},
  } as unknown as PostHog;
}

export function getPostHogClient(): PostHog {
  if (!posthogClient) {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthogClient = noopPostHog();
    } else {
      posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        flushAt: 1,
        flushInterval: 0,
      });
    }
  }
  return posthogClient;
}
