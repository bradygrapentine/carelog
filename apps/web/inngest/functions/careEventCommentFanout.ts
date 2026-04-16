// apps/web/inngest/functions/careEventCommentFanout.ts
import { inngest } from "../client";
import { sendExpoPush, getPushTokensForUsers } from "../pushNotification";
import { getFanoutTargets } from "../../server/repositories/careEventCommentsRepository";
import { supabaseAdmin } from "../../server/supabaseAdmin.server";

type Payload = {
  commentId: string;
  careEventId: string;
  orgId: string;
  authorId: string;
};

type NotifPref = {
  user_id: string;
  care_event_comments: boolean | null;
  push_enabled: boolean | null;
};

export async function runFanout(data: Payload) {
  const targets = await getFanoutTargets(data.careEventId, data.authorId);
  const recipientSet = new Set<string>(
    [targets.eventAuthorId, ...targets.priorCommenterIds].filter(
      (id) => id && id !== data.authorId,
    ),
  );
  if (recipientSet.size === 0) return { pushed: 0 };

  const { data: prefs, error: prefErr } = await supabaseAdmin
    .from("notification_preferences")
    .select("user_id, care_event_comments, push_enabled")
    .in("user_id", Array.from(recipientSet));
  if (prefErr) throw prefErr;

  const prefsMap = new Map((prefs ?? []).map((p: NotifPref) => [p.user_id, p]));

  const finalRecipients = Array.from(recipientSet).filter((id) => {
    const p = prefsMap.get(id);
    if (!p) return true; // no row = default true
    return p.care_event_comments !== false && p.push_enabled !== false;
  });

  if (finalRecipients.length === 0) return { pushed: 0 };

  const tokens = await getPushTokensForUsers(finalRecipients);
  if (tokens.length > 0) {
    const { data: commentRow } = await supabaseAdmin
      .from("care_event_comments")
      .select("body")
      .eq("id", data.commentId)
      .maybeSingle();
    const body = commentRow?.body ?? "";
    const truncated = body.length > 120 ? `${body.slice(0, 117)}…` : body;
    await sendExpoPush(
      tokens.map((to) => ({
        to,
        title: "New comment",
        body: truncated,
        sound: "default" as const,
        data: { careEventId: data.careEventId, commentId: data.commentId },
      })),
    );
  }

  return { pushed: finalRecipients.length };
}

export const careEventCommentFanoutFn = inngest.createFunction(
  { id: "care-event-comment-fanout", name: "Care event comment: push fanout" },
  { event: "careEventComment/created" },
  async ({ event, step }) => {
    return step.run("fanout", () => runFanout(event.data as Payload));
  },
);
