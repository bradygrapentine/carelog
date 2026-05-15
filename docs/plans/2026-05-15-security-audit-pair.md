# SEC-007 — OCR confirm audit-log site

**Date:** 2026-05-15
**Base SHA:** 1d45ed8
**Source backlog:** SEC-007 (SEC-008 deferred at Gate 1)
**Bundle:** C (per `docs/plans/2026-05-15-backlog-execution-graph.md`) — narrowed to single row
**Recommended executor:** direct, single PR (this session)
**Threat model:** `.claude/state/owasp-threat-security-audit-pair.md` (2 Critical, 5 High, 6 Medium, 2 Low — **"include all"** selection)

## Goal

Add an append-only audit-log table `ocr_audit_log` + INSERT site at `POST /api/ocr/confirm`. Closes FIND-003 part 3. MUST land before any real-provider OCR wiring story.

**Important — schema reshape from backlog row:** the literal `confirmed_fields` column the row proposed re-leaks PHI (drug_name/dosage/instructions are PHI when scoped to a recipient). Replaced with `confirmed_field_keys text[]` (allowlist-checked) + `field_count int`. Per-field values stay on `medications` (already RLS-protected).

## Non-goals

- Sentry routing pairing — out of scope; schema designed to NOT block it.
- Audit log for other OCR routes (`save-fields`, `discard`, `review`) — only `confirm` per row scope.
- UI surface for viewing the audit log — service-role-only via DB.
- Backfilling pre-existing OCR confirms beyond what T-07 mitigation requires.

## Required acceptance (from threat model "include all")

| Finding | Severity | Plan section addressing it |
|---|---|---|
| T-01 PHI in confirmed_fields → use keys+hashes | Critical | Track 1 schema + Track 2 INSERT shape |
| T-02 SHA-256 specifically | Critical | Track 1 CHECK + Track 2 hash impl |
| T-03 Explicit RLS enable + service-role-only policy | High | Track 1 migration |
| T-04 Append-only via BEFORE triggers (RLS doesn't help — service_role bypasses) | High | Track 1 migration |
| T-06 Audit INSERT before medication (or atomic); no swallowed errors | High | Track 2 reorder + error handling |
| T-07 Backfill historical confirms | High | Track 1 migration (one-time `DO $$` block) |
| T-08 CHECK constraint on allowlist | Medium | Track 1 migration |
| T-09 No PHI in PostHog/Sentry payload | Medium | Track 2 review note |
| T-10 user_id ON DELETE RESTRICT | Medium | Track 1 migration |
| T-11 ocr_job_id denormalized (no FK) + org_id_snapshot denormalized | Medium | Track 1 migration |
| T-12 ts DEFAULT now() never client-supplied | Medium | Track 1 + Track 2 INSERT shape |
| T-13 Existing rate-limit inherited | Medium | Track 2 comment |
| T-14 SHA-256 in Node, bound param to SQL | Low | Track 2 impl |
| T-15 Migration timestamp `20260516010000_...` | Low | Track 1 filename |

## Pre-flight verification

Cycle-1 reviewer + orchestrator confirmed:
- `apps/web/app/api/ocr/confirm/route.ts` exists (137 lines). Current shape: rate limit → auth → membership-coordinator check → state-machine validation → **medication INSERT** → optimistic-lock status UPDATE → PostHog capture (swallowed) → 200. **Today the route does NOT SELECT `raw_text` from ocr_jobs** — the existing select at line 56-60 fetches only `id, recipient_id, status`. Track 2 must widen the SELECT to include `raw_text` for hashing.
- `posthog.capture` block at L113-129 already correctly avoids PHI (only `org_id`, `document_id`, `field_count`).
- Last migration filename: `20260516000000_revoke_accept_invite_from_anon_authenticated.sql`. New file: `20260516010000_create_ocr_audit_log.sql`.

## Tracks

### Track 1 — `supabase/migrations/20260516010000_create_ocr_audit_log.sql` + pgTAP

**Branch:** `feat/sec-007-ocr-confirm-audit-log` off base SHA `1d45ed8`.

**FILES ALLOWED — production:**
- `supabase/migrations/20260516010000_create_ocr_audit_log.sql` (new)
- `apps/web/lib/database.types.ts` (regenerated via `npx supabase gen types typescript --local 2>/dev/null > apps/web/lib/database.types.ts` — DO NOT hand-edit)

**FILES ALLOWED — tests:**
- `supabase/tests/ocr_audit_log_rls.test.sql` (new pgTAP)

**Migration content (verbatim shape — see threat-model file lines 50-80 for the column block):**

```sql
-- SEC-007: OCR confirm audit log (FIND-003 part 3).
-- Append-only forensic trail of OCR confirm events. PHI-free by construction:
-- stores only field-key allowlist + SHA-256 hashes, never values or raw text.
-- See docs/plans/2026-05-15-security-audit-pair.md for threat model.

CREATE TABLE ocr_audit_log (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ocr_job_id            uuid        NOT NULL,            -- denormalized snapshot, no FK (survives parent cleanup)
  org_id_snapshot       uuid        NOT NULL,            -- denormalized
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  raw_output_hash       bytea       NOT NULL CHECK (octet_length(raw_output_hash) = 32),
  confirmed_field_keys  text[]      NOT NULL CHECK (
    confirmed_field_keys <@ ARRAY['drug_name','dosage','instructions','frequency','prescriber']
  ),
  field_count           int         NOT NULL CHECK (field_count >= 0),
  ts                    timestamptz NOT NULL DEFAULT now(),
  backfilled            boolean     NOT NULL DEFAULT false
);

ALTER TABLE ocr_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit service role only" ON ocr_audit_log
  USING (auth.role() = 'service_role');
-- No INSERT/UPDATE/DELETE policies for authenticated.

-- Append-only via BOTH triggers AND REVOKE (defense-in-depth per T-04 cycle-1
-- review: triggers protect against ordinary writes; REVOKE protects against
-- a future SECURITY DEFINER function using `SET LOCAL session_replication_role
-- = 'replica'` to bypass triggers silently).
CREATE OR REPLACE FUNCTION prevent_ocr_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ocr_audit_log is append-only';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER ocr_audit_no_update BEFORE UPDATE ON ocr_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_ocr_audit_mutation();
CREATE TRIGGER ocr_audit_no_delete BEFORE DELETE ON ocr_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_ocr_audit_mutation();

REVOKE UPDATE, DELETE ON ocr_audit_log FROM PUBLIC;
REVOKE UPDATE, DELETE ON ocr_audit_log FROM authenticated, anon, service_role;
-- service_role's REVOKE is the load-bearing one; PUBLIC/anon/authenticated
-- are belt-and-suspenders since they have no policy to use anyway.

CREATE INDEX ocr_audit_log_ocr_job_id_idx ON ocr_audit_log(ocr_job_id);
CREATE INDEX ocr_audit_log_user_id_ts_idx ON ocr_audit_log(user_id, ts DESC);

-- T-07 backfill: insert placeholder rows for existing confirmed OCR jobs.
-- `raw_output_hash` is the SHA-256 of an empty string (`e3b0c44...`) marker
-- since we no longer have the raw_text for historical jobs. `backfilled=true`
-- distinguishes these from live audit entries.
DO $$
DECLARE
  empty_hash bytea := decode('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'hex');
BEGIN
  INSERT INTO ocr_audit_log (ocr_job_id, org_id_snapshot, user_id, raw_output_hash, confirmed_field_keys, field_count, ts, backfilled)
  SELECT
    j.id,
    j.org_id,
    COALESCE(j.created_by, '00000000-0000-0000-0000-000000000000'::uuid),
    empty_hash,
    ARRAY[]::text[],
    0,
    j.updated_at,
    true
  FROM ocr_jobs j
  WHERE j.status = 'confirmed'
    AND j.created_by IS NOT NULL;  -- skip pre-RLS rows; FK ON DELETE RESTRICT
                                   -- to auth.users means we can't synthesize
                                   -- a system UUID without violating the FK.
                                   -- The COALESCE above is dead code given
                                   -- this filter — kept harmless for clarity.
END $$;

COMMENT ON TABLE ocr_audit_log IS 'Append-only forensic audit of OCR confirm events. PHI-free: keys + hashes only, no values. See migration comment and SEC-007 plan.';
```

**pgTAP coverage (`supabase/tests/ocr_audit_log_rls.test.sql`):**

Use `throws_ok($$sql$$, 'errcode', NULL, 'description')` 4-arg form per `supabase/CLAUDE.md`. `plan(10)`.

1. `is(relrowsecurity, true, ...)` on `pg_class` → RLS enabled on ocr_audit_log
2. As anon: `results_eq($$ SELECT count(*) FROM ocr_audit_log $$, ARRAY[0::bigint], ...)`
3. As authenticated coordinator: same — 0 rows
4. As service_role: `results_eq` against inserted test row count
5. As service_role: `throws_ok($$ UPDATE ocr_audit_log SET ts = now() WHERE id = ... $$, 'P0001', NULL, 'append-only blocks UPDATE')` (P0001 is the errcode for `RAISE EXCEPTION` without explicit code)
6. As service_role: `throws_ok($$ DELETE FROM ocr_audit_log WHERE id = ... $$, 'P0001', NULL, 'append-only blocks DELETE')`
7. `throws_ok($$ INSERT ... raw_output_hash=decode('00', 'hex') ... $$, '23514', NULL, 'length CHECK violation')` (23514 = check_violation)
8. `throws_ok($$ INSERT ... confirmed_field_keys=ARRAY['patient_ssn'] ... $$, '23514', NULL, 'allowlist CHECK violation')`
9. `lives_ok($$ INSERT ... confirmed_field_keys=ARRAY['drug_name','dosage'] ... $$, 'allowlist subset insert succeeds')`
10. `throws_ok($$ DELETE FROM auth.users WHERE id = '<audit-user-id>' $$, '23503', NULL, 'FK RESTRICT blocks user delete')` (23503 = foreign_key_violation)

**Acceptance:**
- `supabase test db` green (all 10 new cases pass + existing 326 pgTAP cases unaffected).
- `npx supabase gen types typescript --local 2>/dev/null > apps/web/lib/database.types.ts` produces a non-empty diff for the new table.
- `cd apps/web && npx tsc --noEmit` clean (regenerated types compile).
- Migration filename collates after `20260516000000` and before any future migration.

### Track 2 — Route handler: SELECT `raw_text`, hash, INSERT audit-log BEFORE medication

**FILES ALLOWED:**
- `apps/web/app/api/ocr/confirm/route.ts` (modify)
- `apps/web/app/api/ocr/confirm/__tests__/route.test.ts` (new OR extend existing — verify upfront)

**FILES OUT OF SCOPE:**
- Other OCR routes (`save-fields`, `discard`, `review`).
- `apps/web/lib/posthog-server.ts`.
- Any `medications` table logic beyond the existing INSERT.
- Audit-log query / read paths (service-role-only; no UI).

**Implementation shape (route reorder):**

1. **Widen the ocr_jobs SELECT** at current L56-60 from `id, recipient_id, status` → `id, recipient_id, status, raw_text`.
2. **After state-machine validation, BEFORE medication INSERT:** compute `raw_output_hash = createHash('sha256').update(NFC-normalize(raw_text || '')).digest()` and `confirmed_field_keys` (filter the 3 known keys by `typeof === 'string' && length > 0`).
3. **INSERT audit row first.** If it errors, return 500 — do NOT proceed to medication insert. NO `try/catch` swallow. Reason: T-06 says audit failure must fail the request loudly (vs PostHog which is safe to swallow).
4. **Then** the existing medication insert + optimistic-lock status update flow (unchanged).
5. PostHog capture (unchanged — already PHI-free).

**Audit semantics — per-attempt, not per-success** (cycle-1 reviewer concern T-06+race, addressed):

The current route has a pre-existing concurrency bug: two concurrent confirm requests both pass the state-machine check (both read `status='parsed'`), both insert medications, one wins the optimistic-lock status UPDATE and one returns 409 — leaving **two medication rows** for the same OCR job. **This bug is older than SEC-007** and not introduced here.

SEC-007 audit semantics intentionally record **every confirm attempt** that passes auth + state-machine, including the 409-loser. From a forensic standpoint that's the CORRECT shape — the audit trail must capture intent, not just success. A future row should fix the underlying race via a SECURITY DEFINER RPC that wraps `SELECT ... FOR UPDATE` on ocr_jobs + medication insert + status UPDATE in one transaction; that's out of SEC-007 scope.

**Sprint-close action:** seed `TD-144` in `/backlog-sync` — "OCR confirm race: medication insert + status update should be atomic via SECURITY DEFINER RPC (currently allows 2 medication rows on concurrent confirm; SEC-007 audit log captures both attempts, which is correct for audit but signals the underlying bug)."

**Acceptance:**
- New test (or extension): stub audit insert to throw → route returns 500 AND no medication row created AND ocr_jobs.status unchanged.
- New test: happy path → 200 AND audit row inserted with correct `confirmed_field_keys` AND `raw_output_hash` is the SHA-256 of the job's raw_text.
- `grep -F "ocr_audit_log" apps/web/app/api/ocr/confirm/route.ts` returns ≥1.
- `grep -F "raw_text" apps/web/app/api/ocr/confirm/route.ts` returns ≥1 (only in the SELECT clause; never echoed to response or logs).
- `npx vitest run` green (2131+ tests; new test pass).

**Risk + mitigations:**

- **Reordering puts audit INSERT before medication INSERT.** If the audit table doesn't exist yet (e.g. migration not applied in CI environment), the route 500s for ALL confirms — outage. Mitigation: this PR ships migration + code in the same diff; Supabase CI runs the migration before vitest in the same job. Local dev needs `supabase db reset` before testing.
- **SHA-256 input must be deterministic.** NFC-normalize the raw_text before hashing (Unicode forms). Use `String.prototype.normalize('NFC')`. Document in code comment.
- **Backfill DO block** uses the empty-string SHA-256 (`e3b0c44...`) as a marker for historical entries. If a future security review looks at "how many real-vs-backfilled rows" it can WHERE `backfilled=true`.
- **CI types regen.** If types weren't regenerated, the route's `.insert({...})` on `ocr_audit_log` will fail typecheck. Local pre-push command in implementation step #1.

## Merge order

Single track logically. Migration + route changes in ONE PR (single squash). pgTAP runs against the new migration in the same CI job that runs the vitest route test.

## Execution gate

`/opus-on-opus docs/plans/2026-05-15-security-audit-pair.md --from-sprint` before /wave. Reviewer must verify each of the 14 "include all" findings maps to a track section.

## Post-merge verification

- `supabase test db` on integrated main — green.
- Manual smoke: confirm an OCR job in dev; query `SELECT count(*) FROM ocr_audit_log` as service_role; expect +1 vs pre-confirm.
- `/post-deploy-watch` not needed — backend-only change with no user-visible behavior shift.

## Risks accepted

- **`confirmed_field_keys` allowlist forward-compat vs route current-state asymmetry.** Allowlist includes `frequency` and `prescriber`, but the route's zod schema (`route.ts:13-19`) only accepts `drug_name/dosage/instructions` today. Forward-compat by design — future OCR fields land without an audit-table migration. Plan does not "fix" the asymmetry; it's intentional.
- **Pre-existing OCR confirm concurrency bug** (409 race producing duplicate medication rows). Audit captures both attempts — correct for audit semantics — but the underlying race is a separate fix (TD-144 seeded at sprint close).
- **Backfill rows have `confirmed_field_keys=ARRAY[]::text[]` and `field_count=0`.** Forensically distinguishable via `backfilled=true`; downstream consumers must check the flag, not infer "empty array means no fields confirmed."

## Open questions

(none — schema, route shape, backfill strategy locked by threat model + cycle-1 review)

## Backlog row update (sprint-close housekeeping)

The BACKLOG.md SEC-007 row text says `{user_id, ocr_job_id, raw_output_hash, confirmed_fields, ts}` — needs updating to reflect the corrected `{user_id, ocr_job_id, org_id_snapshot, raw_output_hash, confirmed_field_keys, field_count, ts, backfilled}` shape. Surface at `/backlog-sync` after this PR merges.
