-- ON-77: Task data model + RLS + configurable role-based permissions.
--
-- Foundation for the Phase 7 Task-coordination epic (blocks ON-79/80/81/82/83/84).
-- A coordinator (or, via ON-83, the recipient) raises a discrete activity that must
-- be completed, optionally pinned to a shift, with role-gated completion.
--
-- Permission model (ADR-0007): a dedicated typed `task_permissions` table, one row
-- per org, with member_role[] arrays for who may CREATE and who may COMPLETE tasks.
-- Coordinators are ALWAYS implicitly allowed regardless of config. The predicates
-- fail closed: a missing task_permissions row falls back to coordinator-only, so
-- absence is safe and no org-creation trigger is required here (out of scope).
--
-- Column/transition authz that RLS WITH CHECK cannot express (it cannot see the OLD
-- row) is enforced by the `tasks_update_guard` BEFORE UPDATE trigger. The trigger fn
-- is SECURITY INVOKER (project idiom: shift_questions_immutable_cols) — auth.uid()
-- still resolves the caller; the authz lives in the SECURITY DEFINER predicate fns
-- it calls. Marking it DEFINER would bypass RLS on incidental reads.

-- ============================================================
-- ENUM
-- ============================================================
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done', 'cancelled');

-- ============================================================
-- TABLES
-- ============================================================
CREATE TABLE tasks (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id           uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  title                  text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  instructions           text        CHECK (instructions IS NULL OR char_length(instructions) <= 10000),
  checklist              jsonb       NOT NULL DEFAULT '[]',
  status                 task_status NOT NULL DEFAULT 'todo',
  assigned_to            uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by             uuid        NOT NULL REFERENCES auth.users(id),
  requested_by           uuid        NOT NULL REFERENCES auth.users(id),
  requested_on_behalf_of uuid        REFERENCES care_recipients(id),
  shift_id               uuid        REFERENCES shifts(id) ON DELETE SET NULL,
  due_at                 timestamptz,
  completed_at           timestamptz,
  completed_by           uuid        REFERENCES auth.users(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  -- a checklist must be a JSON array
  CONSTRAINT tasks_checklist_is_array CHECK (jsonb_typeof(checklist) = 'array')
);

CREATE INDEX tasks_org_recipient_idx ON tasks (org_id, recipient_id);
CREATE INDEX tasks_shift_idx ON tasks (shift_id) WHERE shift_id IS NOT NULL;

-- One configurable permission row per org. coordinator is always implicitly
-- allowed by the predicates below, so the defaults are the fail-closed posture.
CREATE TABLE task_permissions (
  org_id          uuid          PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  creator_roles   member_role[] NOT NULL DEFAULT '{coordinator}',
  completer_roles member_role[] NOT NULL DEFAULT '{coordinator}',
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

-- ============================================================
-- PERMISSION PREDICATES (SECURITY DEFINER, pinned search_path)
-- Fail closed: missing config row → coordinator-only; never NULL/error.
-- ============================================================
CREATE OR REPLACE FUNCTION user_can_create_task(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT user_is_org_coordinator(p_org_id)
    OR EXISTS (
      SELECT 1
      FROM   memberships m
      LEFT JOIN task_permissions tp ON tp.org_id = m.org_id
      WHERE  m.org_id      = p_org_id
        AND  m.user_id     = auth.uid()
        AND  m.accepted_at IS NOT NULL
        AND  m.role = ANY (COALESCE(tp.creator_roles, '{coordinator}'::member_role[]))
    )
$$;

CREATE OR REPLACE FUNCTION user_can_complete_task(p_task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   tasks t
    JOIN   memberships m ON m.org_id = t.org_id
    LEFT JOIN task_permissions tp ON tp.org_id = t.org_id
    WHERE  t.id          = p_task_id
      AND  m.user_id     = auth.uid()
      AND  m.accepted_at IS NOT NULL
      AND  (
        m.role = 'coordinator'
        OR m.role = ANY (COALESCE(tp.completer_roles, '{coordinator}'::member_role[]))
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION user_can_create_task(uuid)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION user_can_complete_task(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION user_can_create_task(uuid)   TO authenticated;
GRANT  EXECUTE ON FUNCTION user_can_complete_task(uuid) TO authenticated;

-- ============================================================
-- ROW LEVEL SECURITY — tasks
-- RLS silently no-ops any operation lacking a policy, so all four are explicit.
-- ============================================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_readable_by_team"
  ON tasks FOR SELECT
  USING (user_can_access_recipient(recipient_id));

CREATE POLICY "tasks_insertable_by_creator"
  ON tasks FOR INSERT
  WITH CHECK (
    user_can_access_recipient(recipient_id)
    AND user_can_create_task(org_id)
    AND created_by = auth.uid()
    AND requested_by = auth.uid()
    AND status = 'todo'
  );

-- Recipient-access gate only; column/transition authz is in tasks_update_guard
-- (RLS WITH CHECK cannot see the OLD row).
CREATE POLICY "tasks_updatable_by_team"
  ON tasks FOR UPDATE
  USING (user_can_access_recipient(recipient_id))
  WITH CHECK (user_can_access_recipient(recipient_id));

CREATE POLICY "tasks_deletable_by_coordinator"
  ON tasks FOR DELETE
  USING (user_is_org_coordinator(org_id));

-- ============================================================
-- UPDATE GUARD TRIGGER (SECURITY INVOKER plpgsql — project idiom)
-- Enforces immutable columns, content-edit authz, completion gating + audit
-- integrity, cancellation/revive authority, and de-completion.
-- ============================================================
CREATE FUNCTION tasks_update_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Immutable columns
  IF NEW.org_id       IS DISTINCT FROM OLD.org_id       THEN RAISE EXCEPTION 'tasks_immutable_column: org_id'; END IF;
  IF NEW.recipient_id IS DISTINCT FROM OLD.recipient_id THEN RAISE EXCEPTION 'tasks_immutable_column: recipient_id'; END IF;
  IF NEW.created_by   IS DISTINCT FROM OLD.created_by   THEN RAISE EXCEPTION 'tasks_immutable_column: created_by'; END IF;
  IF NEW.requested_by IS DISTINCT FROM OLD.requested_by THEN RAISE EXCEPTION 'tasks_immutable_column: requested_by'; END IF;
  IF NEW.created_at   IS DISTINCT FROM OLD.created_at   THEN RAISE EXCEPTION 'tasks_immutable_column: created_at'; END IF;

  -- Content edits require create-permission, coordinator, or being the creator.
  IF (NEW.title        IS DISTINCT FROM OLD.title
   OR NEW.instructions IS DISTINCT FROM OLD.instructions
   OR NEW.checklist    IS DISTINCT FROM OLD.checklist
   OR NEW.assigned_to  IS DISTINCT FROM OLD.assigned_to
   OR NEW.due_at       IS DISTINCT FROM OLD.due_at
   OR NEW.shift_id     IS DISTINCT FROM OLD.shift_id)
  AND NOT (
      user_can_create_task(OLD.org_id)
   OR user_is_org_coordinator(OLD.org_id)
   OR OLD.created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'tasks_edit_forbidden';
  END IF;

  -- Completion: gate + server-force audit fields (kills completed_by forgery).
  IF OLD.status <> 'done' AND NEW.status = 'done' THEN
    IF OLD.status = 'cancelled' THEN
      RAISE EXCEPTION 'tasks_complete_forbidden: cannot complete a cancelled task';
    END IF;
    IF NOT user_can_complete_task(OLD.id) THEN
      RAISE EXCEPTION 'tasks_complete_forbidden';
    END IF;
    NEW.completed_by := auth.uid();
    NEW.completed_at := now();
  END IF;

  -- De-completion (done → non-done that isn't cancel): requires complete-permission.
  IF OLD.status = 'done' AND NEW.status <> 'done' AND NEW.status <> 'cancelled' THEN
    IF NOT user_can_complete_task(OLD.id) THEN
      RAISE EXCEPTION 'tasks_decomplete_forbidden';
    END IF;
    NEW.completed_by := NULL;
    NEW.completed_at := NULL;
  END IF;

  -- Cancellation (→ cancelled from any non-cancelled state): coordinator or creator.
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    IF NOT (user_is_org_coordinator(OLD.org_id) OR OLD.created_by = auth.uid()) THEN
      RAISE EXCEPTION 'tasks_cancel_forbidden';
    END IF;
    NEW.completed_by := NULL;
    NEW.completed_at := NULL;
  END IF;

  -- Revive (cancelled → non-cancelled): same authority as cancel.
  IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
    IF NOT (user_is_org_coordinator(OLD.org_id) OR OLD.created_by = auth.uid()) THEN
      RAISE EXCEPTION 'tasks_revive_forbidden';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_update_guard_trg
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION tasks_update_guard();

-- ============================================================
-- ROW LEVEL SECURITY — task_permissions
-- Readable by any org member; mutated only by coordinators (FIND-003).
-- ============================================================
ALTER TABLE task_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_permissions_readable_by_org"
  ON task_permissions FOR SELECT
  USING (user_in_org(org_id));

CREATE POLICY "task_permissions_insertable_by_coordinator"
  ON task_permissions FOR INSERT
  WITH CHECK (user_is_org_coordinator(org_id));

CREATE POLICY "task_permissions_updatable_by_coordinator"
  ON task_permissions FOR UPDATE
  USING (user_is_org_coordinator(org_id))
  WITH CHECK (user_is_org_coordinator(org_id));
