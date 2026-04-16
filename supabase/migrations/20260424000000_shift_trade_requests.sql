-- ON-45: Shift trade requests
-- Flat status machine, no hard delete, coordinator force-override logged to audit_events.

CREATE TABLE shift_trade_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id        uuid        NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  org_id          uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by    uuid        NOT NULL REFERENCES auth.users(id),
  target_user_id  uuid        REFERENCES auth.users(id),  -- null = open trade
  status          text        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','accepted','declined','expired','cancelled')),
  message         text        CHECK (char_length(message) <= 500),
  resolved_by     uuid        REFERENCES auth.users(id),
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX shift_trade_requests_shift_idx ON shift_trade_requests (shift_id);
CREATE INDEX shift_trade_requests_org_status_idx ON shift_trade_requests (org_id, status);
CREATE INDEX shift_trade_requests_expires_idx ON shift_trade_requests (expires_at) WHERE status = 'open';

ALTER TABLE shift_trade_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: org members only
CREATE POLICY "str_member_select"
  ON shift_trade_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = shift_trade_requests.org_id
        AND m.user_id = auth.uid()
    )
  );

-- INSERT: caller is the shift's current assignee AND requested_by = auth.uid()
CREATE POLICY "str_assignee_insert"
  ON shift_trade_requests FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM shifts s
      WHERE s.id = shift_trade_requests.shift_id
        AND s.assignee_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = shift_trade_requests.org_id
        AND m.user_id = auth.uid()
    )
  );

-- UPDATE: target_user_id (to accept/decline) OR coordinator (force-override)
CREATE POLICY "str_target_or_coordinator_update"
  ON shift_trade_requests FOR UPDATE
  USING (
    target_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = shift_trade_requests.org_id
        AND m.user_id = auth.uid()
        AND m.role = 'coordinator'::member_role
    )
  )
  WITH CHECK (
    target_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = shift_trade_requests.org_id
        AND m.user_id = auth.uid()
        AND m.role = 'coordinator'::member_role
    )
  );

-- DELETE: prohibited (status machine only, no DELETE policy)
