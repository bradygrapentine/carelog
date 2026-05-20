import { z } from "zod";

// ON-77: Task-coordination payloads. Mirrors the `tasks` table + `task_status`
// enum and the `task_permissions` role-array config. Per code style: string-literal
// unions, no enum. These are the wire/validation shapes consumed by the (future)
// tRPC task router (ON-79) and mobile (ON-80) — the DB is the source of truth.

export const taskStatuses = [
  "todo",
  "in_progress",
  "done",
  "cancelled",
] as const;
export const taskStatus = z.enum(taskStatuses);
export type TaskStatus = z.infer<typeof taskStatus>;

// member_role union — kept in sync with the DB `member_role` enum (core_schema).
export const memberRoles = [
  "coordinator",
  "caregiver",
  "supporter",
  "aide",
] as const;
export const memberRole = z.enum(memberRoles);
export type MemberRole = z.infer<typeof memberRole>;

export const checklistItem = z.object({
  label: z.string().min(1).max(200),
  done: z.boolean(),
});
export type ChecklistItem = z.infer<typeof checklistItem>;

// Create payload — server stamps org/created_by/requested_by; client supplies content.
export const createTaskPayload = z.object({
  recipient_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  instructions: z.string().max(10000).nullable().optional(),
  checklist: z.array(checklistItem).max(100).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  shift_id: z.string().uuid().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
});
export type CreateTaskPayload = z.infer<typeof createTaskPayload>;

// Update payload — partial content edits + status transitions. completed_by/at are
// server-forced by the tasks_update_guard trigger, so they are NOT accepted here.
export const updateTaskPayload = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  instructions: z.string().max(10000).nullable().optional(),
  checklist: z.array(checklistItem).max(100).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  shift_id: z.string().uuid().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  status: taskStatus.optional(),
});
export type UpdateTaskPayload = z.infer<typeof updateTaskPayload>;

// Per-org permission config (coordinator-managed). Coordinator is always implicitly
// allowed by the DB predicates regardless of these arrays.
export const taskPermissionsPayload = z.object({
  creator_roles: z.array(memberRole).min(1),
  completer_roles: z.array(memberRole).min(1),
});
export type TaskPermissionsPayload = z.infer<typeof taskPermissionsPayload>;
