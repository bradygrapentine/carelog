# Plan — TD-188 + TD-179 (2026-05-18)

**Sprint slug:** `td-188-179-oop-tail-and-emergency-info-rpc`
**Base SHA:** `2e48b5f` (post-#621 merge)
**Tracks:** 2 (file-disjoint, parallel-eligible)
**Mode:** `/wave` parallel dispatch, 2 PRs

---

## Track A — TD-188: 3 /oop residuals from TD-186 sprint

### Three sub-fixes, one PR

1. **Tighten `POSTGRES_CONSTRAINT_RE` in `formatMutationError.ts`**
   - Current `/\b[a-zA-Z_][a-zA-Z0-9_]*_(pkey|key|idx|fkey|check|excl|unique)\b/gi` over-strips legitimate user-facing fields (`license_key`, `api_idx`, etc.). Verified: `"The license_key field is required"` → `"The  field is required"` post-strip.
   - **Fix:** make the regex require a PG-style table-name-style prefix (lowercase, underscore-separated, ≥2 segments before the suffix), AND gate the entire stripping pass on the raw message containing PG diagnostic markers (`duplicate key|violates|constraint`). Implementation:
     ```ts
     const PG_DIAG_RE = /\b(duplicate key|violates|constraint)\b/i;
     const POSTGRES_CONSTRAINT_RE = /\b[a-z][a-z0-9]*(_[a-z0-9]+){1,}_(pkey|fkey|key|idx|check|excl|unique)\b/gi;
     // Only strip if message looks like a PG diagnostic
     if (PG_DIAG_RE.test(rawMessage)) {
       cleaned = cleaned.replace(POSTGRES_CONSTRAINT_RE, "").replace(/\s{2,}/g, " ").trim();
     }
     ```
   - Add ≥4 tests (existing 17 stay): (a) `"The license_key field is required"` → unchanged (no PG diag marker); (b) `"duplicate key value violates unique constraint memberships_org_id_user_id_key"` → constraint name stripped; (c) `"violates check constraint users_age_check"` → stripped; (d) `"This api_idx is invalid"` → unchanged (no diag marker, single-segment prefix).

2. **Drop `flushSync` from `useEditMode.ts` (contract migration, not a silent change)**
   - `flushSync` is unnecessary in React 19 event handlers (setters batch + flush before next paint) and warns when caller is mid-commit (e.g., parent passes `onCancel={() => parentSet(...)}` during render).
   - **Caller-impact verification (MANDATORY before code change):** grep for ALL `useEditMode({` usages in `apps/web/`. Read each caller's `onCancel` body. The contract reversal is safe ONLY if no caller reads `isEditing` synchronously inside `onCancel`. Today's sole caller is `EmergencyFooterCard.tsx:50-58` which only sets local input state — safe. Document the grep result in the PR body.
   - **Fix:** call `setIsEditing(false)` + `setError(null)` + `onCancel?.()` in sequence; remove `flushSync` import.
   - JSDoc update: explicitly DELETE the prior "LOCKED (TD-186)" annotation and ADD a `// TD-188 contract migration: dropped flushSync (React 19 batches; warning hazard). onCancel runs synchronously after setters scheduled; callers MUST NOT read isEditing inside onCancel — schedule via setTimeout or read from a ref if needed.` comment with a 1-line CHANGELOG-style note at the top.
   - Acceptance: caller-grep documented in PR body; existing 2 hook ordering tests still green; add 1 test confirming no React warning when `onCancel` triggers a parent state update.

3. **Accept `TemplateLiteral` (no interpolation) in `forbiddenTagKey` rule**
   - Current rule checks `keyArg.type === "Literal"` only. `` Sentry.setTag(`email`, x) `` parses as `TemplateLiteral` with `expressions.length === 0` — bypasses detection.
   - **Fix:** in `no-phi-in-analytics.js` line ~255, accept both shapes:
     ```js
     let keyName = null;
     if (keyArg.type === "Literal" && typeof keyArg.value === "string") keyName = keyArg.value;
     else if (keyArg.type === "TemplateLiteral" && keyArg.expressions.length === 0) keyName = keyArg.quasis[0].value.cooked;
     ```
   - Add ≥2 tests: `` Sentry.setTag(`email`, x) `` FAILS via `forbiddenTagKey`; `` Sentry.setTag(`user_${id}`, x) `` (has interpolation) does NOT fire `forbiddenTagKey` (spreadIdentifier-class — caller's responsibility).

### Acceptance (all)

- [ ] `formatMutationError.ts`: 2-step strip (PG diag gate + tightened regex) + 4+ new tests.
- [ ] `useEditMode.ts`: `flushSync` removed; JSDoc updated; 1+ new test verifying no warning on parent-state-update path.
- [ ] `no-phi-in-analytics.js`: `forbiddenTagKey` accepts no-interpolation `TemplateLiteral`; 2+ new tests.
- [ ] `pnpm lint` clean, full vitest suite green, typecheck clean.

### Files (Track A owned)

- `apps/web/lib/formatMutationError.ts`
- `apps/web/lib/__tests__/formatMutationError.test.ts`
- `apps/web/hooks/useEditMode.ts`
- `apps/web/hooks/__tests__/useEditMode.test.tsx`
- `apps/web/eslint-rules/no-phi-in-analytics.js`
- `apps/web/eslint-rules/__tests__/no-phi-in-analytics.test.mjs`

### Branch

`fix/td-188-format-error-and-flushsync`

### Risks

- **PG diag gate may be too strict.** If tRPC re-wraps Postgres errors and strips the original `duplicate key`/`violates`/`constraint` substring before reaching the formatter, the constraint name will leak through. Verify by checking 1-2 existing real error shapes (grep tRPC error mocks in tests).
- **tRPC `err.cause.message` not inspected.** Today's `extractMessage` reads `err.message` only. If tRPC wraps the PG error with a generic outer message and stuffs the PG diag string into `err.cause.message`, the gate never matches and the constraint leaks via a different path. **Decision (locked here):** `PG_DIAG_RE.test(\`${err.message} ${err.cause?.message ?? ""}\`)` — concatenated string is used ONLY as gate input. **NEVER** copy `cause.message` into `cleaned` / output / Sentry / toast — stripping + output remain sourced from `err.message` alone. Add 2 test cases: (a) gate matches on cause.message → strip applies to err.message; (b) cause.message contains a fake PHI value → that value MUST NOT appear in formatter output even when gate fires.

### Decision (locked) — Sub-fix #2 ordering migration safety

Sole `useEditMode({ onCancel })` caller today is `EmergencyFooterCard.tsx`. PR body MUST include the grep output (`grep -rn "useEditMode" apps/web/`) to prove caller-impact verification.

---

## Track B — TD-179: `update_emergency_info` SECURITY DEFINER RPC + pgTAP

### Why

`identityRepository.updateEmergencyInfo` (lines 99-161) does read-merge-write in JS:
1. SELECT current `contact_info`
2. JS-merge with patch
3. UPDATE with full merged object

Under concurrent writes (~ms window), Writer A's merge sees the pre-Writer-B state, then UPDATEs and silently overwrites B's field. Not a 409 — a silent revert. Today's risk is bounded (1 coordinator usually edits at a time), but exposure grows with future multi-edit surfaces.

### Plan

1. **New migration** `supabase/migrations/<timestamp>_update_emergency_info_rpc.sql`:
   ```sql
   create or replace function public.update_emergency_info(
     p_org_id uuid,
     p_recipient_id uuid,
     p_patch jsonb
   )
   returns jsonb
   language plpgsql
   security definer
   set search_path = public, pg_temp  -- CVE-2018-1058 mitigation; matches project idiom (confirm_ocr_job_rpc.sql)
   as $$
   declare
     v_token text;
     v_result jsonb;
   begin
     -- 1. Resolve identity_token via care_recipients (enforces org_id boundary)
     select identity_token into v_token
     from care_recipients
     where id = p_recipient_id and org_id = p_org_id;
     if v_token is null then
       raise exception 'recipient_not_found' using errcode = 'P0002';  -- "no data found"
     end if;

     -- 2. Atomic deep-merge via jsonb_strip_nulls(existing || patch)
     -- Stripping nulls implements the "null/empty → clear key" semantics that
     -- updateEmergencyInfo.ts had in JS (lines 131-149).
     update identity_vault
     set contact_info = jsonb_strip_nulls(coalesce(contact_info, '{}'::jsonb) || p_patch)
     where token = v_token and org_id = p_org_id
     returning contact_info into v_result;

     if v_result is null then
       raise exception 'identity_not_found' using errcode = '45IDF';  -- user-defined SQLSTATE (class 45xxx); P0003 is reserved by Postgres for too_many_rows
     end if;
     return v_result;
   end;
   $$;

   -- Lock down: revoke from anon/authenticated; only service role can call.
   revoke all on function public.update_emergency_info(uuid, uuid, jsonb) from public, anon, authenticated;
   grant execute on function public.update_emergency_info(uuid, uuid, jsonb) to service_role;

   comment on function public.update_emergency_info is
     'Atomic shallow top-level merge (||) of emergency info patch into identity_vault.contact_info. '
     'Nested objects are replaced wholesale, NOT deep-merged (matches prior JS impl semantics). '
     'jsonb_strip_nulls implements null-as-clear-key semantics. '
     'Eliminates read-merge-write race. SECURITY DEFINER + org_id check + service_role-only.';
   ```

2. **New pgTAP test** `supabase/tests/update_emergency_info.test.sql`:
   - Plans ≥6 tests:
     1. Returns the merged jsonb when recipient + identity exist.
     2. Raises `recipient_not_found` when `recipient_id` not in `p_org_id` (cross-org access denied).
     3. Raises `recipient_not_found` when `recipient_id` doesn't exist.
     4. `jsonb_strip_nulls` removes a key when patch sets it to `null` (the "clear field" semantic). E.g., `{"dnr_status": "DNR"}` then `{"dnr_status": null}` → `{}`.
     5. Patch with `null` value for an absent key is a no-op (`{}` → `{}`).
     6. Idempotent re-application: applying same patch twice produces identical state.
     7. **Disjoint-keys serial merge** (NOT true concurrency simulation — pgTAP single-backend can't simulate concurrent txns): apply patch `{dnr_status: 'DNR'}` then patch `{hospital: 'St. Mary'}` and assert final `contact_info` has both keys. This proves the merge semantics; true concurrent-writer testing is deferred to a JS integration test outside this sprint (note in PR body — not seeding a new TD row for this; "shown sufficient by deferred integration test" pattern).
   - Permission test: `set role to anon; select update_emergency_info(...)` → permission denied.

3. **Repo refactor** `apps/web/server/repositories/identityRepository.ts`:
   - Replace lines 99-161 body with a single `supabaseAdmin.rpc("update_emergency_info", { p_org_id, p_recipient_id, p_patch })` call.
   - Build `p_patch` from the existing `EmergencyInfoPatch` argument: for `null`/`""` values, pass `null` (lets `jsonb_strip_nulls` clear the key); for defined non-empty values, pass the value. Function signature unchanged.
   - **Error mapping (LOCKED via distinct SQLSTATE):** RPC raises `P0002` for `recipient_not_found` and `P0003` for `identity_not_found` (intentionally distinct so JS can branch on `error.code` without string-matching `error.message`). Map:
     - `error?.code === 'P0002'` → `throw new Error('recipient_not_found')`
     - `error?.code === '45IDF'` → `throw new Error('identity_not_found')`
     - Other error → `throw new Error('identity_update_failed: <error.message>')` (preserves prior catch-all shape).

4. **Repo tests** (`apps/web/server/repositories/__tests__/identityRepository.test.ts`):
   - Update any existing `updateEmergencyInfo` tests that mocked `supabaseAdmin.from().select()/.update()` chains — switch to mocking `supabaseAdmin.rpc(...)`.
   - Add 1 happy-path RPC mock test + 1 each for `recipient_not_found` and `identity_not_found` error mapping.

### Acceptance

- [ ] Migration applies cleanly: `supabase db reset` → new function exists, permissions correct (`\df+ update_emergency_info` shows `security definer`, `service_role` execute only).
- [ ] `supabase test db` passes — new pgTAP tests + all existing ones still green.
- [ ] `apps/web/server/repositories/__tests__/identityRepository.test.ts` passes; repo function signature unchanged.
- [ ] `pnpm migration-check` clean (no schema drift between local and linked-prod modulo this migration).
- [ ] Full vitest suite green; typecheck clean.
- [ ] **No PHI leak in error paths:** when the RPC raises `recipient_not_found` / `identity_not_found`, the repo function's caught error MUST NOT include the input `recipientId`/`orgId` in any Sentry capture. Verify by re-reading the call sites (`apps/web/server/routers/recipients.ts` for the tRPC wrapper).

### Files (Track B owned)

- NEW: `supabase/migrations/20260518090000_update_emergency_info_rpc.sql`
- NEW: `supabase/tests/update_emergency_info.test.sql`
- `apps/web/server/repositories/identityRepository.ts` (only `updateEmergencyInfo` function — lines 99-161; do NOT touch other functions)
- `apps/web/server/repositories/__tests__/identityRepository.test.ts` (only `updateEmergencyInfo` test block)

### Risks

- **`pnpm migration-check` may surface drift** from prior migrations if local is behind. Run `supabase db reset` first to ensure clean state.
- **`jsonb_strip_nulls`** only strips top-level nulls, not nested. Current `EmergencyInfoPatch` has flat keys (`dnrStatus`, `hospital`, `primaryContact`) — verify the patch shape stays flat at the RPC boundary. If `primaryContact` is an object, only top-level `null` removes the whole object, not individual fields (matches current JS behavior).
- **SECURITY DEFINER + service_role-only** is correct here because `supabaseAdmin` already runs as service role. Verify caller chain: tRPC `recipients.updateEmergencyInfo` mutation already authorizes via session-org check before calling the repo function — no new attack surface.

### Branch

`feat/td-179-update-emergency-info-rpc`

---

## Cross-track invariants

- **PHI rule (HARD):** TD-188 extends PHI rule coverage; TD-179 writes to PHI vault — error paths must not echo recipient_id / org_id back to logs.
- **No BACKLOG.md edits** in either PR.
- **Branch hygiene:** verify `git branch --show-current` before every commit; pre-commit hook on YAML/markdown-only diffs flakes (not applicable here — both tracks touch code).
- **Local green gates PR ready.**

## Merge order

Independent — no soft dependencies. Either order. Arm auto-merge on both at PR open.

## Wave dispatch shape

2 tracks × 2 PRs × parallel `Task` dispatch with worktrees (`.worktrees/td-188-format-error/`, `.worktrees/td-179-emergency-info-rpc/`). Heartbeat per global rules. **Track B subagent must run `supabase db reset` + `supabase test db` locally** — flag if supabase isn't running.
