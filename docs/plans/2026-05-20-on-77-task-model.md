# ON-77 — Task data model + RLS + configurable role-based permissions

**Date:** 2026-05-20
**Base SHA:** 15842a2826f0af504bdee7e8a3f167c58c9db6d9
**Source backlog:** ON-77 (P1/High — Phase 7 Task-coordination epic foundation; blocks ON-79/80/81/82/83/84)
**PRD:** n/a (backlog row is the spec)
**Threat model:** `.claude/state/owasp-threat-on-77.md` (selection: include all — FIND-001/002/003 are mandatory pgTAP-backed acceptance)
**Recommended executor:** /sprint (full pipeline) — single-track, direct.

## Goal

Ship the database foundation for the Phase 7 Task-coordination epic: a `tasks` table, a `task_status` enum, a configurable per-org role→capability permission model, RLS policies (read/create/complete/cancel) backed by a deny-by-default completion predicate, full pgTAP coverage, regenerated TS types, a task payload schema, and ADR-0007 documenting the permission-model decision. This unblocks all of ON-79–84.

## Design decision (resolves the row's open question; → ADR-0007)

Three options were posed (per-org jsonb config / per-task `allowed_completer_roles` / both). **Chosen: a dedicated typed `task_permissions` table, one row per org**, with two `member_role[]` columns:

- `creator_roles member_role[] NOT NULL DEFAULT '{coordinator}'`
- `completer_roles member_role[] NOT NULL DEFAULT '{coordinator}'`

Rationale: typed arrays (not jsonb) eliminate shape-validation fail-open risk (threat FIND-004), are CHECK/constraint-friendly, and default fail-closed (coordinator-only). **Coordinator is always implicitly allowed** to create+complete regardless of config (predicate ORs in `user_is_org_coordinator`). Per-task granularity (`allowed_completer_roles`) is rejected as over-engineered for a $14/mo family product. Admin = coordinator in this product (no separate admin role in `member_role`); config writes are coordinator-only.

## Non-goals

- **No web/mobile UI** — that's ON-79 (web) / ON-80 (mobile). This track is DB + types + schema + ADR only.
- **No notifications wiring** (on-call routing) — ON-81.
- **No recipient-initiated task flow logic** beyond the `requested_on_behalf_of` column existing — ON-83.
- **No tRPC task router** — downstream (ON-79). Stop at the DB contract + payload schema.
- **No task verification layer** — ON-84 (deferred).
- Do not touch existing migrations, `shifts`, or unrelated schemas.

## Tracks

### Track 1 — task-model (the whole row; single track)

**Sources backlog ON-77.**

**FILES ALLOWED** (modify/create):
- `supabase/migrations/20260520000000_tasks.sql` (new — table, enum, task_permissions table, RLS, completion predicate)
- `supabase/tests/tasks.test.sql` (new — pgTAP)
- `apps/web/lib/database.types.ts` (regenerate only — do not hand-edit)
- `packages/schemas/src/tasks.ts` (new — Zod task payload + status union)
- `packages/schemas/src/index.ts` (add export line for tasks)
- `packages/schemas/src/__tests__/tasks.test.ts` (new — schema unit tests)
- `docs/adr/0007-task-permission-model.md` (new)
- `docs/adr/README.md` (add ADR-0007 index row)

**FILES OUT OF SCOPE — DO NOT TOUCH:**
- `BACKLOG.md` (per BACKLOG-as-SoT; `/backlog-sync` reconciles)
- Any existing migration file or `supabase/seed.sql`
- `apps/web/app/**`, `apps/web/components/**` (no UI — ON-79)
- `apps/mobile/**` (ON-80)
- Any tRPC router / `apps/web/server/**`
- Any `shifts` / unrelated schema or test

**Branch:** `feat/on-77-task-model` off base SHA above.

**Model:** `opus-direct` — root Opus implements. New RLS surface is security-critical (high blast radius); the completion-permission predicate is the novel control. Orchestrator owns it directly rather than delegating; all post-wave gates still run.

**Implementation steps:**
1. **Migration `20260520000000_tasks.sql`:**
   a. `CREATE TYPE task_status AS ENUM ('todo','in_progress','done','cancelled');`
   b. `CREATE TABLE tasks` with columns per the row: `id uuid PK default gen_random_uuid()`, `org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`, `recipient_id uuid NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE`, `title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200)`, `instructions text` (markdown; nullable), `checklist jsonb NOT NULL DEFAULT '[]'` (ordered `[{label,done}]`), `status task_status NOT NULL DEFAULT 'todo'`, `assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL`, `created_by uuid NOT NULL REFERENCES auth.users(id)`, `requested_by uuid NOT NULL REFERENCES auth.users(id)`, `requested_on_behalf_of uuid REFERENCES care_recipients(id)` (ON-83), `shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL`, `due_at timestamptz`, `completed_at timestamptz`, `completed_by uuid REFERENCES auth.users(id)`, `created_at timestamptz NOT NULL DEFAULT now()`. Index `(org_id, recipient_id)` and `(shift_id) WHERE shift_id IS NOT NULL`.
   c. `CREATE TABLE task_permissions (org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE, creator_roles member_role[] NOT NULL DEFAULT '{coordinator}', completer_roles member_role[] NOT NULL DEFAULT '{coordinator}', updated_at timestamptz NOT NULL DEFAULT now());`
   d. **Permission predicates** (both `SECURITY DEFINER LANGUAGE sql STABLE SET search_path = public, pg_temp`, and both `REVOKE EXECUTE ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated;` per FIND-005):
      - `user_can_complete_task(p_task_id uuid) RETURNS boolean` — true when the caller's membership role for the task's org ∈ `completer_roles` OR `user_is_org_coordinator(org)`. **Fail-closed:** uses `COALESCE`/`LEFT JOIN` so a missing `task_permissions` row yields the column DEFAULT semantics (coordinator-only) and the function returns `false` (never NULL/error) for a non-permitted caller.
      - `user_can_create_task(p_org_id uuid) RETURNS boolean` — same against `creator_roles`.
   e. **RLS** on `tasks`: `ENABLE ROW LEVEL SECURITY`. Four explicit policies (RLS silently no-ops any operation lacking a policy — `supabase/CLAUDE.md`):
      - SELECT `tasks_readable_by_team` USING `user_can_access_recipient(recipient_id)`.
      - INSERT `tasks_insertable_by_creator` WITH CHECK `user_can_access_recipient(recipient_id) AND user_can_create_task(org_id) AND created_by = auth.uid() AND requested_by = auth.uid() AND status = 'todo'`.
      - UPDATE `tasks_updatable_by_team` USING `user_can_access_recipient(recipient_id)` WITH CHECK `user_can_access_recipient(recipient_id)`. **Column/transition-level authz is enforced by the BEFORE UPDATE trigger (step f), NOT this policy** — because RLS WITH CHECK cannot see the OLD row and so cannot gate *which* columns changed or *what* the prior status was.
      - DELETE `tasks_deletable_by_coordinator` USING `user_is_org_coordinator(org_id)` — must be explicit or hard delete silently no-ops for everyone.
   f. **`tasks_update_guard()` BEFORE UPDATE trigger** — **plain `LANGUAGE plpgsql` `SECURITY INVOKER`, NO pinned search_path** (matches the verified idiom `shift_questions_immutable_cols`, `20260509000000_shift_questions.sql:61`). INVOKER is required: `auth.uid()` still returns the real caller, and the authz lives in the DEFINER predicate fns it calls — marking the trigger DEFINER would run it as the migration owner and bypass RLS on any incidental table read (cycle-2 must-fix). Closes the FIND-002 escalation + FIND-002b audit-forgery hole RLS alone cannot:
      - **Immutable cols:** reject if `NEW.org_id/recipient_id/created_by/requested_by/created_at` differ from OLD → `RAISE EXCEPTION 'tasks_immutable_column'`.
      - **Content edits** (title/instructions/checklist/assigned_to/due_at/shift_id changed): require `user_can_create_task(OLD.org_id) OR user_is_org_coordinator(OLD.org_id) OR OLD.created_by = auth.uid()` (creator may edit own) else `RAISE EXCEPTION 'tasks_edit_forbidden'`.
      - **Completion** (`OLD.status <> 'done' AND NEW.status = 'done'`): require `user_can_complete_task(OLD.id)`; force `NEW.completed_by := auth.uid()` and `NEW.completed_at := now()` server-side (ignore client values → kills FIND-002b forgery); reject completing an already-`cancelled` task.
      - **Cancellation** (`NEW.status = 'cancelled'`, from any non-cancelled state): require `user_is_org_coordinator(OLD.org_id) OR OLD.created_by = auth.uid()`.
      - **De-completion** (`OLD.status='done' AND NEW.status<>'done'`): require `user_can_complete_task(OLD.id)`; null out `completed_by/completed_at`.
      - **Revive from cancelled** (`OLD.status='cancelled' AND NEW.status<>'cancelled'`): require `user_is_org_coordinator(OLD.org_id) OR OLD.created_by = auth.uid()` (same authority as cancel).
      - **Transition matrix — intentionally OPEN** (gated only by content-edit + recipient-access rules, no extra authz): lateral non-terminal moves `todo↔in_progress` by any team member. Documented as intended: progressing one's own work doesn't need completer rights. All terminal/`done`/`cancelled` edges ARE gated above.
   g. **RLS** on `task_permissions`: SELECT `task_permissions_readable_by_org` USING `user_in_org(org_id)` (the real helper — `core_schema.sql:332`); INSERT+UPDATE coordinator-only (`user_is_org_coordinator(org_id)` in both USING and WITH CHECK) → satisfies FIND-003.
   h. **Default-row seeding is OUT OF SCOPE** (no org-creation trigger here). The predicates fail-closed on a missing row (coordinator-only), so absence is safe. Document the contract in the migration header.
2. **pgTAP `supabase/tests/tasks.test.sql`** — `SELECT plan(N)` (count exactly): table/enum/column existence; RLS enabled; **FIND-001** cross-org SELECT denied + cross-org INSERT denied; **FIND-002** completion: coordinator completes (allow), non-permitted-role completes (deny), permitted non-coordinator role after config widen (allow), cross-recipient completer (deny); **FIND-002 escalation (the must-fix):** non-permitted member edits `title`/reassigns `assigned_to` → trigger denies (`tasks_edit_forbidden`); non-permitted member flips `status='cancelled'` → denies; **FIND-002b forgery:** permitted user completes but passes a foreign `completed_by` → row persists with `completed_by = auth.uid()` (server-forced); **immutability:** UPDATE of `created_by`/`org_id` → `tasks_immutable_column`; **FIND-003** non-coordinator UPDATE of `task_permissions` denied; **FIND-005** the two NEW SECURITY DEFINER predicate fns (`user_can_create_task`, `user_can_complete_task`) have pinned search_path — assert via `'search_path=public, pg_temp' = ANY(proconfig)` (project idiom — see `supabase/tests/confirm_ocr_job.test.sql:97`), schema-qualified by `pronamespace='public'::regnamespace`. (The `tasks_update_guard` trigger fn is SECURITY INVOKER plpgsql — NOT in this assertion.) Match the project's pgTAP idiom (`supabase/CLAUDE.md`).
3. **Types regen:** `npx supabase gen types typescript --local 2>/dev/null > apps/web/lib/database.types.ts` (the `2>/dev/null` is load-bearing — gotcha).
4. **Schema `packages/schemas/src/tasks.ts`:** `taskStatus` string-literal union (`'todo'|'in_progress'|'done'|'cancelled'`), `checklistItem` (`{label: string (1..200), done: boolean}`), `taskPayload` Zod (title 1..200, instructions max 10000 nullable, checklist array max 100, due_at optional). Export from `index.ts`. Unit tests in `__tests__/tasks.test.ts`.
5. **ADR-0007** `docs/adr/0007-task-permission-model.md` — context (Phase 7 needs role-gated task completion), decision (dedicated typed `task_permissions` table, coordinator-implicit, fail-closed), alternatives rejected (jsonb config, per-task column), consequences. Add index row to `docs/adr/README.md`.

**Acceptance (verifiable):**
- `pnpm migration-check` clean (no drift).
- `supabase test db` green; new file `supabase/tests/tasks.test.sql` runs and all planned assertions pass.
- `grep -n "search_path = public, pg_temp" supabase/migrations/20260520000000_tasks.sql` finds it on the 2 new SECURITY DEFINER predicate fns (FIND-005). The `tasks_update_guard` trigger fn is SECURITY INVOKER (no search_path) — verify it is NOT marked `SECURITY DEFINER`: `! grep -A2 "FUNCTION tasks_update_guard" supabase/migrations/20260520000000_tasks.sql | grep -q "SECURITY DEFINER"`.
- `grep -nE "tasks_readable_by_team|tasks_insertable_by_creator|tasks_updatable_by_team|tasks_deletable_by_coordinator" supabase/migrations/20260520000000_tasks.sql` finds all four policies.
- `grep -nE "tasks_update_guard|tasks_edit_forbidden|tasks_immutable_column" supabase/migrations/20260520000000_tasks.sql` finds the guard trigger + its raises.
- `grep -nE "REVOKE EXECUTE|GRANT EXECUTE" supabase/migrations/20260520000000_tasks.sql` confirms the predicates are revoked from PUBLIC/anon, granted to authenticated.
- pgTAP includes: cross-org deny (FIND-001), non-permitted-role completion deny (FIND-002), the escalation deny (non-permitted edit/cancel), the forgery case (server-forced `completed_by`), and non-coordinator `task_permissions` UPDATE deny (FIND-003) — grep test file for the case descriptions.
- `cd apps/web && npx tsc --noEmit` clean after types regen.
- `pnpm --filter @carelog/schemas test` (schemas live in `packages/schemas`, not `apps/web`) green incl. new `tasks.test.ts`; or root `pnpm test`.
- `test -f docs/adr/0007-task-permission-model.md` and ADR-0007 row present in `docs/adr/README.md`.
- CI green on PR (Lint, Typecheck, Web matrix, RLS pgTAP).

**Risk + mitigations:**
- *Completion predicate fails open on missing config row* → predicate written fail-closed (coordinator-only fallback); pgTAP asserts deny path explicitly.
- *Non-permitted member edits task content / forges `completed_by` / cancels* → the FIND-002 hole RLS WITH CHECK cannot close (no OLD visibility); closed by the `tasks_update_guard` BEFORE UPDATE trigger (step 1f) with pgTAP escalation + forgery + immutability cases.
- *Cross-org leak via wrong recipient scope* → every policy routes through `user_can_access_recipient`; pgTAP cross-org case.
- *`member_role[]` array-containment perf* → small N (≤4 roles); acceptable, no index needed.
- *Types regen contaminated by Docker logs* → `2>/dev/null` redirect (documented gotcha).
- **PRE-EXISTING (out of scope, must-fix-4 from review):** the trusted base helpers `user_can_access_recipient` (`core_schema.sql:304`), `user_in_org` (:332), `user_is_org_coordinator` (:344) are SECURITY DEFINER with **no** pinned `search_path`. ON-77's new RLS leans on them. ON-77 does NOT harden them (would touch out-of-scope core schema). This is partially TD-207's territory (TD-207 names `claim_outer_circle_slot` + `shift_questions_immutable_cols` but NOT these three core helpers). **Action:** the executor must NOT silently rely on them being safe — surface to the user a recommendation to widen TD-207 (or seed a follow-up TD row) to pin search_path on these three. Recorded here, not fixed here.

**Column set is FROZEN (review should-fix 7):** the `tasks` columns above are the complete ON-77 set. `requested_by NOT NULL` + nullable `requested_on_behalf_of` are intentionally created now (cheap, avoids an ON-83 ALTER); ON-83 adds *behavior* (recipient-initiated flow), not columns. Do not add/rename columns in ON-79–84 without a migration row.

## Merge order

Single track — no ordering. One branch, one PR.

## Execution gate

Run `/opus-on-opus docs/plans/2026-05-20-on-77-task-model.md --from-sprint` before dispatch. Apply must-fix findings. (Sprint Gate 2 owns user interaction.)

## Post-merge verification

- `git pull && pnpm migration-check && supabase test db && cd apps/web && npx tsc --noEmit` on integrated main.
- No `/post-deploy-watch` — DB-only foundation, no production-visible behavior until ON-79 ships UI.

## Open questions

- None blocking. The permission-model shape is resolved above (→ ADR-0007). If the user prefers per-task `allowed_completer_roles` instead, flag at Gate 2 — but the typed-table default is recommended.
