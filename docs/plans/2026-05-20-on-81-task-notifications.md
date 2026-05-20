# ON-81 — Configurable task notifications (email + in-app; on-call routing)

**Date:** 2026-05-20
**Base SHA:** 69d8a1d (origin/main, post ON-79b #682 + backlog #683)
**Source backlog:** ON-81 (P1 — Phase 7 Task epic; unblocked by ON-77 #675 lifecycle + ON-78 #662 on-call type)
**PRD:** n/a · builds on ADR-0007 (task model) + the established notification infra
**Threat model:** `.claude/state/owasp-threat-on-81.md` (selection: **include all** — 0 Crit / 2 High / 2 Med / 1 Low)
**Recommended executor:** /sprint — single-track, direct (opus-direct). Root Opus implements (PHI + RLS + new table = retain full context); all post-wave gates run.

## Goal

Close the task loop: when a task is **created / assigned / completed**, notify the right people via email (Resend) and a new lightweight in-app feed, honoring per-user notification preferences and on-call routing (a task arriving during an `on_call` shift's window notifies that shift's `assignee_user_id`; the requester is notified on completion). Reuse the live Resend + `email_dispatch_log` (idempotency) + Inngest + `notification_preferences` + `careEventCommentFanout` fanout pattern — no new external dependency.

## Non-goals

- **Push notifications** (Expo) — explicitly deferred to the mobile launch (separate row).
- **Per-task notification overrides** — v1 is per-user preference + sensible org defaults; per-task config is a later row.
- SMS (the `sms_enabled` column exists but stays unused here).
- No changes to the ON-77 RLS/trigger or the ON-79 task router authz (only ADD `inngest.send` emit points).
- Do not touch `BACKLOG.md`, mobile, `proxy.ts`, auth.

## Threat controls (folded in as acceptance — all 5 findings)

- **FIND-001 (High, PHI):** task `title`/`instructions` may be PHI. Email bodies plain-text; **no task content into posthog/Sentry** (ESLint `carelog/no-phi-in-analytics` clean). In-app feed stores a `task_id` ref + a non-PHI event type/label; if a human-readable title is stored, it sits behind owner-only RLS. PHI sentinel test (mirror `refillAlert.test.ts`) asserts no name/phone/email leaks into the dispatched body.
- **FIND-002 (High, cross-team leak):** targets resolved ONLY from `memberships` scoped to the task's `org_id` + `recipient_id` (mirror `getFanoutTargets`); on-call resolution looks up the `on_call` shift for THAT recipient/org only, **targeting `shifts.assignee_user_id`** (NOT `assigned_to` — that column is `assignee_user_id` per `20260408000001_shifts_schema_align.sql`; `tasks.assigned_to` is the task column, don't conflate). Test: a user outside the recipient's team is never a target.
- **FIND-003 (Med, pref IDOR):** task-pref writes go through the existing owner-only `notification_preferences` RLS (`user_id = auth.uid()`); no client-supplied `user_id` trusted.
- **FIND-004 (Med, feed RLS):** new `in_app_notifications` table — owner-only SELECT/UPDATE (`user_id = auth.uid()`), INSERT service-role only (default-deny for `authenticated`). pgTAP coverage.
- **FIND-005 (Low, retry):** `email_dispatch_log` idempotency. Exact insert shape (the table's unique is `(kind, dedup_key)` and `org_id` is NOT NULL): `kind = 'task'`, `dedup_key = '<type>:<task_id>:<user_id>'`, `org_id = <task org>`, `recipient_id = <task recipient>`. INSERT-before-send, UPDATE `sent_at` on success. **Pending-row sweep** at the top of each fanout invocation (mirror `refillAlert.ts`): clear `kind='task' AND sent_at IS NULL AND created_at < now() - interval '15 min'` so a crash between INSERT and Resend doesn't permanently suppress that user's notification.

## Tracks

### Track 1 — task-notifications (single track, opus-direct)

**Sources backlog ON-81.**

**FILES ALLOWED** (modify/create):
- `supabase/migrations/20260520010000_task_notifications.sql` (new) — (a) `ALTER TABLE notification_preferences ADD COLUMN task_assigned boolean NOT NULL DEFAULT true, ADD COLUMN task_completed boolean NOT NULL DEFAULT true, ADD COLUMN task_created boolean NOT NULL DEFAULT false` (created defaults off — coordinators create a lot; assigned/completed default on); (b) `CREATE TABLE in_app_notifications (id uuid pk, user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE, org_id uuid NOT NULL, recipient_id uuid, type text NOT NULL CHECK (type IN ('task_assigned','task_completed','task_created')), task_id uuid, title text, body text, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())` + index on `(user_id, created_at desc) where read_at is null`; **partial UNIQUE index `(user_id, type, task_id)` to make the service-role in-app INSERT idempotent against double-emit** (mirrors the email dedup); RLS ENABLED, owner-only `SELECT`/`UPDATE` (`user_id = auth.uid()`), NO insert policy (service-role inserts from Inngest; default-deny for `authenticated`).
- `supabase/tests/task_notifications.test.sql` (new) — pgTAP: in_app_notifications owner reads own only / non-owner 0 rows / authenticated cannot INSERT; the new pref columns inherit owner-only (assert one).
- `apps/web/lib/database.types.ts` — regenerate (`npx supabase gen types typescript --local 2>/dev/null > apps/web/lib/database.types.ts`).
- `packages/schemas/src/notifications.ts` (new) + `packages/schemas/src/index.ts` (export) — `taskNotificationPrefsPayload` (the 3 task bools + email_enabled passthrough), `inAppNotification` shape, `taskNotificationType` union.
- `apps/web/inngest/functions/taskNotificationFanout.ts` (new) — the dispatch fn. Input event `{ type, taskId, orgId, recipientId, actorId }`. Resolve targets scoped to org+recipient (assignee for assigned/completed; requester for completed; on-call assignee when a task is created during an `on_call` shift window). Per-target: read `notification_preferences`; INSERT `in_app_notifications` (always, unless the per-type pref is off); if `email_enabled` && per-type on → INSERT-before-send `email_dispatch_log` (dedup `task:<type>:<taskId>:<userId>`), `resend.emails.send` plain-text PHI-safe body, UPDATE `sent_at`. Mirror `careEventCommentFanout.ts` + `refillAlert.ts`.
- `apps/web/inngest/functions/__tests__/taskNotificationFanout.test.ts` (new) — target scoping (no cross-team target — FIND-002), idempotency double-fire (FIND-005), PHI sentinel on body (FIND-001), on-call routing resolves the covering `on_call` shift's assignee.
- `apps/web/app/api/inngest/route.ts` — register `taskNotificationFanoutFn` in the `serve({ functions: [...] })` array.
- `apps/web/server/routers/tasks.ts` — add `inngest.send` emit points AFTER the successful write (mirror `careEventComments.ts:33` `inngest.send(...).catch()`). No authz change. Fire-and-forget; never block/fail the mutation on a send error (wrap + Sentry-capture). **Emit from ALL paths that produce the state change, not just the named procedures:** `create`→`task/created`; `assign`→`task/assigned`; `complete`→`task/completed`; **AND `update`** keyed off the patch delta — if the patch sets `assigned_to` (to a non-null, changed value) emit `task/assigned`; if it sets `status:'done'` emit `task/completed` (the ON-79 router lets `update` assign/complete, so emitting only from the named procedures silently drops those). Email idempotency (`email_dispatch_log` (kind,dedup_key)) makes a double-fire for the same task+user+type a no-op for email; the in-app insert is guarded the same way (check-before-insert on `(user_id,type,task_id)` or rely on a partial unique index — see migration).
- `apps/web/server/routers/notifications.ts` — add `listInApp` (RLS-scoped `in_app_notifications` for `ctx.user`, newest first, optional unread filter), `markRead` (single id; RLS UPDATE), `taskPrefs`/`setTaskPrefs` (read/upsert the caller's `notification_preferences` task columns via `ctx.supabase`). Keep `registerToken`.
- `apps/web/server/routers/__tests__/notifications.logic.test.ts` (new or extend) — listInApp RLS scoping, markRead, setTaskPrefs owner-only.
- `apps/web/app/(app)/notifications/page.tsx` + `NotificationsClient.tsx` (new) — lightweight unread list (TintedCard, `.claude/rules/ui-standards.md`): `notifications.listInApp.useQuery`, mark-read on click, link each to its task (`?panel=tasks`). Empty/loading states.
- `apps/web/app/(app)/settings/` notification-preferences section — extend the existing settings notification UI with the 3 task toggles (`setTaskPrefs`). (If the settings notif UI is a separate component, that file is in scope; confirm at impl.)
- Tests for the notifications route/client.

**FILES OUT OF SCOPE — DO NOT TOUCH:**
- `BACKLOG.md`, `apps/mobile/**`, `proxy.ts`, auth/session files.
- ON-77 migration / RLS / `tasks_update_guard` trigger; the ON-79 task-router authz logic (only ADD emit points).
- Other routers/panels/Inngest functions not listed.
- `packages/schemas` files other than `notifications.ts` + `index.ts`.

**Branch:** `feat/on-81-task-notifications` off base SHA above.

**Model:** `opus-direct` — root Opus implements. PHI + RLS + new table + cross-team authz = high blast; retain full context; all post-wave gates (incl. `/a11y` for the new UI) run.

**Implementation steps (sequenced — push early after the migration+types commit):**
1. **Migration + types** — write `20260520010000_task_notifications.sql` (pref cols + `in_app_notifications` + RLS); `pnpm migration-check`; `supabase start` if needed; regenerate `database.types.ts`. Write `task_notifications.test.sql` pgTAP; `supabase test db` green. **Commit + push** (small, gets CI moving).
2. **Schemas** — `packages/schemas/src/notifications.ts` + index export. `pnpm --filter @carelog/schemas build` if the package builds.
3. **Dispatch fn** — `taskNotificationFanout.ts` mirroring `careEventCommentFanout.ts` (target resolution + pref check) and `refillAlert.ts` (email_dispatch_log INSERT-before-send + plain-text body + **pending-row sweep**). Register in `api/inngest/route.ts`. Uses `supabaseAdmin` (service-role) for the in-app INSERT (bypasses the no-INSERT-policy default-deny, per the `email_dispatch_log` precedent). Write its test (FIND-001/002/005 + on-call). Specifics:
   - **On-call resolver:** `shifts` rows with `shift_type='on_call'`, matching `recipient_id`+`org_id`, where the injected `now` ∈ `[start_at, end_at)`; target each row's **`assignee_user_id`** (NOT `assigned_to`). **Overlapping on_call shifts:** notify ALL distinct covering assignees (deduped by user) — there's no single-on-call constraint, so "notify every on-call caregiver covering now" is the correct, surprise-free rule. Document it.
   - **`now` injection:** the resolver takes `now: Date` as a parameter (default `new Date()` at the fn entry, not inline in the query body) so the test injects a deterministic instant — React-19/purity discipline + testability.
   - **Actor exclusion:** never notify the actor about their own action (mirror `careEventCommentFanout.ts` `id !== authorId`) — e.g. a coordinator assigning a task to themselves, or an assignee completing their own task, gets no email/in-app for that event. The `actorId` rides in the event payload.
   - **Quiet hours:** OUT of scope for v1 task notifications — these are transactional (not digest) events; `quiet_hours_*` applies to digests. State this explicitly in a code comment so a future reader doesn't assume it's a bug.
   - **In-app INSERT ordering + collision:** insert the `in_app_notifications` row BEFORE the email send (so a Resend failure on retry re-runs fanout with the in-app row already idempotently present). The partial-unique `(user_id,type,task_id)` INSERT WILL throw `23505` on a concurrent double-fire — catch `23505` and continue (mirror the email path's `23505` handling in `refillAlert.ts:216-225`); never let it bubble and fail the fanout step.
4. **Event emission** — add `inngest.send({ name: "task/assigned" | "task/completed" | "task/created", data: { taskId, orgId, recipientId, actorId: ctx.user.id } })` in `tasks.ts` after the write, in create/assign/complete AND in `update` (delta-keyed: `assigned_to` set→assigned, `status:'done'`→completed); wrap so a send failure never fails the mutation (Sentry-capture). UUID-only in any analytics (`actorId` etc. are UUIDs; never task title/instructions).
5. **Router** — `notifications.ts` `listInApp`/`markRead`/`taskPrefs`/`setTaskPrefs`. Tests.
6. **UI** — `/notifications` route + client (unread list, mark-read, link to task); settings task-pref toggles. a11y per ui-standards.
7. **Full verify** — `npx vitest run` green; `npx tsc --noEmit` (modulo pre-existing schema-walker TS2589); `npx eslint --quiet` clean on touched; `supabase test db` green. **Note:** new router procedures change the TD-197 API schema snapshot → bump `apps/web/server/api-version.ts` `API_VERSION` (1.1.0 → 1.2.0) + refresh baseline (`UPDATE_SCHEMA_SNAPSHOT=1 npx vitest run`).

**Acceptance (verifiable):**
- `grep -c "inngest.send" apps/web/server/routers/tasks.ts` ≥ 4 — emit points in create/assign/complete AND the delta-keyed `update` path (assignment/completion via `update` must not silently drop).
- `grep -n "assignee_user_id" apps/web/inngest/functions/taskNotificationFanout.ts` — on-call routing targets the correct shift column (NOT `assigned_to`); a test asserts the actor is never self-notified.
- `grep -c "in_app_notifications" supabase/migrations/20260520010000_task_notifications.sql` ≥ 1; RLS owner-only policies present; `supabase test db` green incl. the new pgTAP file (owner-reads-own + non-owner-0-rows + authenticated-cannot-insert).
- `grep -rn "email_dispatch_log" apps/web/inngest/functions/taskNotificationFanout.ts` — idempotency wired; dedup key `task:<type>:<taskId>:<userId>`.
- PHI: `taskNotificationFanout.test.ts` has a sentinel asserting no name/phone/email in the email body; ESLint `carelog/no-phi-in-analytics` clean.
- Cross-team: a test asserts a non-member is never a target; on-call routing test resolves the covering `on_call` shift's assignee.
- `notifications.listInApp` is RLS-scoped (a user sees only their own rows) — router test asserts.
- `npx vitest run` green; CI green (Lint, Typecheck, Web matrix, RLS pgTAP, **a11y**); `API_VERSION` bumped + snapshot refreshed.

**Risk + mitigations:**
- *Scope at single-track upper bound (~11 files)* → strictly sequenced + push-early after step 1; one cohesive feature, one PR. If step 3 (dispatch fn) balloons, the in-app feed UI (step 6) is the natural cut line → ON-81b. Surface at /wave if it overruns.
- *Cross-team PHI leak via mis-scoped targets* → FIND-002 test + reuse `getFanoutTargets`-style membership scoping; Opus reviews the target resolver.
- *Mutation blocked by a notification send failure* → emit is fire-and-forget, wrapped, Sentry-captured; the task write already committed.
- *Schema-snapshot test breaks CI* → expected (new procedures); API_VERSION bump + baseline refresh in step 7 (per TD-197/ADR-0006).
- *Inngest event never fires in test env* → unit-test the fanout fn directly (as refillAlert does), not via the live Inngest runtime.

## Merge order

Single track — one branch, one PR.

## Execution gate

`/opus-on-opus docs/plans/2026-05-20-on-81-task-notifications.md --from-sprint`. Verify each `.claude/state/owasp-threat-on-81.md` finding (all 5 selected) maps to a track/acceptance line; any missed finding = must-fix. Apply must-fix.

## Post-merge verification

- `git pull && cd apps/web && npx tsc --noEmit && npx vitest run`; `supabase test db`. `/a11y` post-wave gate (new UI).
- Optionally trigger a task event in a dev env and confirm one email + one in-app row (idempotent on retry).

## Open questions

- **In-app surface placement:** plan assumes a `/notifications` route + unread list (lightweight, per the row). A header bell-badge is a deliberate follow-up, not v1. If you'd rather the bell now, say so before /wave.
