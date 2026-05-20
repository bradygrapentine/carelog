# ADR-0007 — Task completion-permission model: per-org typed role arrays

Date: 2026-05-20
Status: Accepted
Backlog: ON-77

## Context

Phase 7 introduces a Task-coordination surface (`tasks` table): a coordinator — or, via ON-83, the recipient — raises a discrete activity that must be completed, optionally pinned to a shift, with **role-gated completion**. The product needs two configurable authority decisions per organization: (a) which member roles may CREATE tasks, and (b) which member roles may COMPLETE a given org's tasks. The existing role union is `member_role = coordinator | caregiver | supporter | aide` (`supabase/migrations/20260327234330_core_schema.sql:12`); there is no separate "admin" — `coordinator` is the top role.

Three shapes were considered for storing the capability map:

1. **Per-org `task_permissions` jsonb config** on `organizations` (or a dedicated table) keyed by role→capability.
2. **Per-task `allowed_completer_roles` column** on each `tasks` row.
3. **Both.**

## Decision

A **dedicated typed `task_permissions` table, one row per org**, with two `member_role[]` columns:

- `creator_roles member_role[] NOT NULL DEFAULT '{coordinator}'`
- `completer_roles member_role[] NOT NULL DEFAULT '{coordinator}'`

Enforcement lives in two `SECURITY DEFINER` predicate functions with pinned `search_path = public, pg_temp`:

- `user_can_create_task(org_id)` — true if the caller is a coordinator OR the caller's accepted membership role ∈ `creator_roles`.
- `user_can_complete_task(task_id)` — true if the caller is a coordinator OR the caller's role ∈ `completer_roles`.

**Coordinators are ALWAYS implicitly allowed** (the predicates OR in the coordinator check) regardless of config. The predicates **fail closed**: a `LEFT JOIN` with `COALESCE(..., '{coordinator}')` means a missing `task_permissions` row degrades to coordinator-only, never to allow-all. No org-creation seeding trigger is required — absence is safe.

Config writes are **coordinator-only** (RLS `WITH CHECK user_is_org_coordinator(org_id)` on INSERT + UPDATE); reads are open to any org member.

Column/transition authorization that RLS `WITH CHECK` cannot express — because it cannot see the OLD row — is enforced by a `tasks_update_guard` BEFORE UPDATE trigger (immutable columns, content-edit authority, completion gating with server-forced `completed_by`/`completed_at`, cancel/revive authority). That trigger is plain `SECURITY INVOKER` plpgsql (project idiom: `shift_questions_immutable_cols`); `auth.uid()` resolves the real caller and the authority decisions delegate to the DEFINER predicates above. Marking the trigger DEFINER would bypass RLS on any table it reads.

## Alternatives rejected

- **jsonb config (option 1):** untyped — an unrecognized role key or malformed shape can silently fail-open in the predicate (threat-model FIND-004). Typed `member_role[]` makes the shape unrepresentable-if-wrong by construction and is CHECK/constraint-friendly.
- **Per-task `allowed_completer_roles` (option 2):** per-task granularity is over-engineered for a single $14/mo family product and pushes permission management onto every task author. Org-level config matches how a family actually delegates.
- **Both (option 3):** unnecessary surface area now; revisit only if a concrete per-task-override requirement appears.

## Consequences

- Adding a per-task override later is additive (a nullable `allowed_completer_roles` column whose presence supersedes the org config) — not a rewrite.
- The completion predicate is the load-bearing security control; it has explicit pgTAP allow/deny coverage (cross-org, non-permitted-role, widened-role, forgery) in `supabase/tests/tasks.test.sql`.
- The trusted base helpers (`user_can_access_recipient`, `user_in_org`, `user_is_org_coordinator`) lack pinned `search_path`; ON-77 leans on them but does not harden them (out of scope — partially TD-207's territory). A follow-up should pin those three.
