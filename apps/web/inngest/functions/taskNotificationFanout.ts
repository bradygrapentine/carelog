import { inngest } from "../client";
import { supabaseAdmin } from "../../server/supabaseAdmin.server";
import { resend } from "../../server/resend.server";
import type { TaskNotificationType } from "@carelog/schemas";
import * as Sentry from "@sentry/nextjs";

// ON-81: task-notification fanout. Triggered by task/created|assigned|completed
// events emitted from the tasks router. Resolves targets scoped to the task's
// care team (FIND-002), honors per-user notification_preferences (FIND-003),
// writes an in-app feed row (FIND-004) + a plain-text email (FIND-001) with
// email_dispatch_log idempotency + pending-row sweep (FIND-005).
//
// AuthZ: every membership read is scoped to the task's org_id + recipient_id so
// a user outside the recipient's care team is never a target. The actor is
// never notified about their own action.

export type TaskNotificationEventData = {
  type: TaskNotificationType;
  taskId: string;
  orgId: string;
  recipientId: string;
  actorId: string;
};

type TaskRow = {
  org_id: string;
  recipient_id: string;
  assigned_to: string | null;
  requested_by: string | null;
  title: string | null;
};

/** Stable per-(type,task,user) idempotency key for email_dispatch_log. */
export function taskDedupKey(
  type: TaskNotificationType,
  taskId: string,
  userId: string,
): string {
  return type + ":" + taskId + ":" + userId;
}

/**
 * Plain-text task email. The body goes ONLY to verified care-team members and
 * carries the task title (authorized context) — but NEVER the recipient's
 * name/phone/email or any analytics payload (FIND-001). Subject is generic.
 */
export function buildTaskEmail(
  type: TaskNotificationType,
  title: string | null,
): { subject: string; body: string } {
  const label =
    type === "task_assigned"
      ? "A task was assigned to you."
      : type === "task_completed"
        ? "A task was completed."
        : "A new task was created.";
  const lines = [label, ""];
  if (title) lines.push("Task: " + title);
  lines.push("");
  lines.push("Open CareSync to view the details.");
  return { subject: "A task update from CareSync", body: lines.join("\n") };
}

/**
 * Resolve the raw target user IDs for an event, scoped to the task's care team.
 * `now` is injected for deterministic on-call resolution (no inline new Date()).
 */
export async function resolveTargetUserIds(
  data: TaskNotificationEventData,
  task: TaskRow,
  now: Date,
): Promise<string[]> {
  let candidates: string[] = [];

  if (data.type === "task_assigned") {
    if (task.assigned_to) candidates = [task.assigned_to];
  } else if (data.type === "task_completed") {
    // The requester is notified on completion (+ assignee, if different).
    candidates = [task.requested_by, task.assigned_to].filter(
      (id): id is string => Boolean(id),
    );
  } else {
    // task_created → on-call routing: every on_call shift covering `now` for
    // this recipient; notify each shift's assignee. Overlapping shifts → notify
    // all distinct covering assignees.
    const nowIso = now.toISOString();
    const { data: shifts, error } = await supabaseAdmin
      .from("shifts")
      .select("assignee_user_id")
      .eq("org_id", data.orgId)
      .eq("recipient_id", data.recipientId)
      .eq("shift_type", "on_call")
      .lte("start_at", nowIso)
      .gt("end_at", nowIso);
    if (error) throw error;
    candidates = (shifts ?? [])
      .map((s) => s.assignee_user_id as string | null)
      .filter((id): id is string => Boolean(id));
  }

  // Exclude the actor; dedupe.
  const set = new Set(candidates.filter((id) => id && id !== data.actorId));
  if (set.size === 0) return [];

  // FIND-002: verify each candidate is on the task's care team (org + recipient
  // scope). recipient_id NULL on a membership = org-wide (all recipients).
  const { data: members, error: memErr } = await supabaseAdmin
    .from("memberships")
    .select("user_id, recipient_id")
    .eq("org_id", data.orgId)
    .not("accepted_at", "is", null)
    .in("user_id", Array.from(set));
  if (memErr) throw memErr;
  const allowed = new Set(
    (members ?? [])
      .filter(
        (m) => m.recipient_id === null || m.recipient_id === data.recipientId,
      )
      .map((m) => m.user_id as string),
  );
  return Array.from(set).filter((id) => allowed.has(id));
}

/** Core fanout — pure of the Inngest runtime, `now` injected for tests. */
export async function runTaskNotificationFanout(
  data: TaskNotificationEventData,
  now: Date,
): Promise<{ inApp: number; emails: number }> {
  // Sweep stale pending task-email dispatch rows (>15 min) so a crash between
  // INSERT and send doesn't permanently suppress a user's notification.
  const cutoff = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const { error: sweepErr } = await supabaseAdmin
    .from("email_dispatch_log")
    .delete()
    .eq("kind", "task")
    .is("sent_at", null)
    .lt("created_at", cutoff);
  if (sweepErr) {
    Sentry.captureException(sweepErr, {
      tags: {
        component: "inngest.taskNotificationFanout",
        path: "sweep.error",
      },
    });
  }

  const { data: task, error: taskErr } = await supabaseAdmin
    .from("tasks")
    .select("org_id, recipient_id, assigned_to, requested_by, title")
    .eq("id", data.taskId)
    .maybeSingle();
  if (taskErr) throw taskErr;
  if (!task) return { inApp: 0, emails: 0 };

  const targets = await resolveTargetUserIds(data, task as TaskRow, now);
  if (targets.length === 0) return { inApp: 0, emails: 0 };

  // Static select (data.type is exactly one of the three task pref columns) so
  // the row stays typed; no runtime-built select string.
  const { data: prefs, error: prefErr } = await supabaseAdmin
    .from("notification_preferences")
    .select(
      "user_id, email_enabled, task_assigned, task_completed, task_created",
    )
    .in("user_id", targets);
  if (prefErr) throw prefErr;
  type PrefRow = {
    user_id: string;
    email_enabled: boolean | null;
    task_assigned: boolean | null;
    task_completed: boolean | null;
    task_created: boolean | null;
  };
  const prefMap = new Map(
    (prefs ?? []).map((p) => [(p as PrefRow).user_id, p as PrefRow]),
  );

  let inApp = 0;
  let emails = 0;
  const { subject, body } = buildTaskEmail(data.type, (task as TaskRow).title);

  for (const userId of targets) {
    const pref = prefMap.get(userId);
    // No row = default: assigned/completed on, created off (matches DB defaults).
    const typeOn = pref
      ? pref[data.type] !== false
      : data.type !== "task_created";
    if (!typeOn) continue;

    // (1) In-app row FIRST (idempotent; survives an email-send failure on retry).
    const { error: inAppErr } = await supabaseAdmin
      .from("in_app_notifications")
      .insert({
        user_id: userId,
        org_id: data.orgId,
        recipient_id: data.recipientId,
        type: data.type,
        task_id: data.taskId,
        title: (task as TaskRow).title,
        body,
      });
    if (inAppErr) {
      const code = (inAppErr as { code?: string }).code;
      if (code !== "23505") {
        // 23505 = already inserted (double-fire) → fine, skip. Anything else is real.
        Sentry.captureException(inAppErr, {
          tags: {
            component: "inngest.taskNotificationFanout",
            path: "inapp.insert.error",
          },
        });
        throw inAppErr;
      }
    } else {
      inApp++;
    }

    // (2) Email (opt-out via email_enabled), idempotent via email_dispatch_log.
    const emailOn = pref ? pref.email_enabled !== false : true;
    if (!emailOn || !resend) continue;

    const dedupKey = taskDedupKey(data.type, data.taskId, userId);
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("email_dispatch_log")
      .insert({
        org_id: data.orgId,
        recipient_id: data.recipientId,
        kind: "task",
        dedup_key: dedupKey,
      })
      .select("id")
      .single();
    if (insErr) {
      if ((insErr as { code?: string }).code === "23505") continue; // already sent/in-flight
      Sentry.captureException(insErr, {
        tags: {
          component: "inngest.taskNotificationFanout",
          path: "dispatch.insert.error",
        },
      });
      throw insErr;
    }

    const { data: userRes } =
      await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userRes?.user?.email;
    if (!email || typeof email !== "string") continue;

    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
        to: [email],
        subject,
        text: body,
      });
    } catch (sendErr) {
      // Leave the dedup row pending; the next-tick sweep clears it. PHI-clean tags.
      Sentry.captureException(sendErr, {
        tags: {
          component: "inngest.taskNotificationFanout",
          path: "resend.error",
        },
      });
      throw sendErr;
    }

    await supabaseAdmin
      .from("email_dispatch_log")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", inserted.id);
    emails++;
  }

  return { inApp, emails };
}

export const taskNotificationFanoutFn = inngest.createFunction(
  {
    id: "task-notification-fanout",
    name: "Task notifications: email + in-app fanout",
  },
  [
    { event: "task/assigned" },
    { event: "task/completed" },
    { event: "task/created" },
  ],
  async ({ event, step }) => {
    return step.run("fanout", () =>
      runTaskNotificationFanout(
        event.data as TaskNotificationEventData,
        new Date(),
      ),
    );
  },
);
