import webPush from "web-push";
import { supabaseAdmin } from "../server/supabaseAdmin.server";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Configure VAPID once at module load (no-ops when env vars are absent)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL ?? "admin@caresync.app"}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

type PushMessage = {
  to: string;
  title?: string;
  body: string;
  sound?: "default";
  data?: Record<string, unknown>;
};

/**
 * Sends one or more push messages to the Expo Push API.
 * Throws if the API returns a non-2xx status.
 */
export async function sendExpoPush(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Expo Push API ${res.status}: ${text}`);
  }
}

/**
 * Fetches push tokens for all accepted coordinators in the org,
 * then sends them the given notification.
 */
export async function sendPushToOrgCoordinators(
  orgId: string,
  notification: {
    title?: string;
    body: string;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  // Step 1: resolve coordinator user IDs for this org
  const { data: members, error: memberError } = await supabaseAdmin
    .from("memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "coordinator")
    .not("accepted_at", "is", null);

  if (memberError || !members || members.length === 0) return;

  const userIds = members.map((m) => m.user_id);

  // Step 2: fetch push tokens for those users
  const { data: tokenRows, error: tokenError } = await supabaseAdmin
    .from("push_tokens")
    .select("token")
    .in("auth_user_id", userIds);

  if (tokenError || !tokenRows || tokenRows.length === 0) return;

  const messages: PushMessage[] = tokenRows.map((r) => ({
    to: r.token,
    sound: "default",
    ...notification,
  }));

  await sendExpoPush(messages);
}

/**
 * Fetches push tokens for a list of user IDs.
 * Returns an empty array if none are found.
 */
export async function getPushTokensForUsers(
  userIds: string[],
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { data } = await supabaseAdmin
    .from("push_tokens")
    .select("token")
    .in("auth_user_id", userIds);
  return (data ?? []).map((r) => r.token);
}

/**
 * Sends a push notification to a single user identified by their auth user ID.
 * No-ops silently if the user has no registered push token.
 */
export async function sendPushToUser(
  userId: string,
  notification: {
    title?: string;
    body: string;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  const { data: tokenRows, error } = await supabaseAdmin
    .from("push_tokens")
    .select("token")
    .eq("auth_user_id", userId);

  if (error || !tokenRows || tokenRows.length === 0) return;

  const messages: PushMessage[] = tokenRows.map((r) => ({
    to: r.token,
    sound: "default" as const,
    ...notification,
  }));

  await sendExpoPush(messages);
}

/**
 * Sends a web push notification to all registered browser subscriptions for a user.
 * Silently removes expired/invalid subscriptions (HTTP 410).
 * PHI rule: payload contains only title, body, and a URL — never user PII.
 */
export async function sendWebPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  const { data: subs } = await supabaseAdmin
    .from("web_push_subscriptions")
    .select("endpoint, p256dh_key, auth_key")
    .eq("auth_user_id", userId);

  if (!subs?.length) return;

  const payloadStr = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map((sub) =>
      webPush
        .sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
          },
          payloadStr,
        )
        .catch(() =>
          supabaseAdmin
            .from("web_push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint),
        ),
    ),
  );
}
