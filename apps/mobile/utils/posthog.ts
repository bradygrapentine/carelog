import PostHog from "posthog-react-native";

const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let client: PostHog | null = null;

// No-ops cleanly when key is unset so dev/test runs don't pollute the project.
export async function initPostHog(): Promise<PostHog | null> {
  if (client) return client;
  if (!key) return null;
  client = new PostHog(key, { host, disableGeoip: true });
  return client;
}

// Identify by auth user UUID only — never email or display_name (PHI rule).
export function identifyUser(userId: string): void {
  client?.identify(userId);
}

export function resetUser(): void {
  client?.reset();
}

type EventProperties = Record<string, string | number | boolean | null>;

// Thin wrapper so callers don't have to null-check on every site.
export function capture(event: string, properties?: EventProperties): void {
  client?.capture(event, properties);
}
