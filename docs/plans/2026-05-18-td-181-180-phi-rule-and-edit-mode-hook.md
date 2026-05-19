# Plan — TD-181 + TD-180 (2026-05-18)

**Sprint slug:** `td-181-180-phi-rule-and-edit-mode-hook`
**Base SHA:** `b23a029` (post-#615 merge)
**Tracks:** 2 (file-disjoint, parallel-eligible)
**Mode:** `/wave` parallel dispatch, 2 PRs

---

## Track A — TD-181: extend `no-phi-in-analytics` to Resend + retire grep sentinel

### Scope reality check (vs backlog row)

Reading `apps/web/eslint-rules/no-phi-in-analytics.js`, the rule **already covers** `Sentry.captureException(err, ctx)` and `Sentry.addBreadcrumb({...})` — TD-181's row text claims those are missing; they're not. Actual gaps:

1. **Resend not covered.** No target matcher for `resend.emails.send({ subject|html|from|headers|to|cc|bcc: ... })`. ON-71 Phase 2 (PR #599) added `refillAlert.ts` PHI sentinel as a brittle file-grep test in `refillAlert.test.ts` precisely because the lint rule doesn't see Resend.
2. **Spread-identifier blind spot.** Rule's JSDoc admits it can't see `Sentry.captureException(err, { extra: input })` where `input` is a variable — needs manual review today. Worth flagging the bare identifier as a warning (separate messageId), opt-out via `// eslint-disable-next-line carelog/no-phi-in-analytics`.

### Acceptance

- [ ] Rule matches `resend.emails.send({...})` with `args[0]` as the inspected object. Forbidden keys checked recursively (Resend's full object — `to`/`subject`/`html`/`from`/`reply_to`/`headers` are all leak surfaces for **key** PHI). Test: a fixture with `{ headers: { email: "..." } }` should fail.
- [ ] New rule warning (separate `messageId: "spreadIdentifier"`) when a target call's analytics-arg position holds a bare `Identifier` (non-literal). Message: "PHI rule: cannot statically verify {{argName}} — pass an object literal or add `// eslint-disable-next-line carelog/no-phi-in-analytics` with a justifying comment."
- [ ] All 7 historical PHI target surfaces still pass: `posthog.identify`, `posthog.capture`, `Sentry.setUser`, `Sentry.setContext`, `Sentry.captureException`, `Sentry.addBreadcrumb`, and new `resend.emails.send`.
- [ ] Existing rule unit tests in `apps/web/eslint-rules/__tests__/no-phi-in-analytics.test.mjs` (currently 143 lines) all still pass.
- [ ] **New unit tests:** ≥3 for Resend (forbidden `email` key in `headers`; forbidden `phone` in nested `to` object; safe rendered `from: "CareSync <noreply@…>"` literal passes), ≥2 for spread-identifier warning (one true positive on `Sentry.captureException(err, ctx)` where `ctx` is an Identifier; one with `eslint-disable-next-line` comment that suppresses).
- [ ] `pnpm lint` from repo root passes (rule changes can't regress existing call sites).
- [ ] Manual sweep: grep `resend.emails.send` across `apps/web/` and confirm 0 new lint failures. Acceptance gate: `ZERO` net-new errors. If spread-identifier warning fires on >5 existing sites, ship it as `warn` (not `error`) and document promotion-to-error as a follow-up TD row.
- [ ] **`apps/web/inngest/functions/__tests__/refillAlert.test.ts` PHI sentinel KEPT in full.** Rationale: the sentinel does grep-based detection of (a) PHI field-name STRINGS inside Sentry blocks (`drug_name`, `pharmacy`), (b) `...input`/`...patch`/`...event` SPREAD patterns, (c) template-string interpolation in `subject:`, (d) `html:` field presence, (e) `pharmacy` substrings in the entire `resend.emails.send` call site. The keys-only ESLint rule statically catches NONE of these — it inspects property KEYS, not VALUES, strings, or template literals. The lint rule is additive defense; the sentinel remains the load-bearing guard for refillAlert. **Add a comment block above the sentinel explaining the static/dynamic split** so future readers don't mistakenly assume the lint rule replaces it.

### Files

**Owned (no other track touches these):**

- `apps/web/eslint-rules/no-phi-in-analytics.js` — add Resend target + spread-id warning
- `apps/web/eslint-rules/__tests__/no-phi-in-analytics.test.mjs` — add Resend + spread tests
- `apps/web/inngest/functions/__tests__/refillAlert.test.ts` — **only** add a comment block above the sentinel test explaining the static/dynamic coverage split. Do NOT remove the sentinel.

**Touched but isolated to verification:** `pnpm lint` sweep across all `resend.emails.send` call sites. Any lint failure there is a real PHI bug that must be fixed in scope.

### Risks

- **Noise.** If existing Resend calls pass PHI today, the rule turn-on becomes a blocker. Mitigation: lint sweep is part of acceptance; any pre-existing violation gets fixed in the same PR or surfaced before merge.
- **False positives on spread-identifier warning.** Triage by lowering severity to "warn" (not "error") if churn > 3 sites; can promote later.

### Branch

`feat/td-181-phi-eslint-resend-spread`

---

## Track B — TD-180: extract `useEditMode<TForm>` hook

### Acceptance

- [ ] New `apps/web/hooks/useEditMode.ts` with the **factory-pattern signature** below. Both target components today configure tRPC `useMutation({ onSuccess, onError })` at construction time (CareTeamList.tsx:116-127 `inviteMutation`; EmergencyFooterCard.tsx:51-60 `mutation`). The hook must NOT try to observe mutation state post-hoc — it returns composable `onSuccess`/`onError` handlers the caller threads into `useMutation({...})`.
- [ ] New `apps/web/hooks/__tests__/useEditMode.test.tsx` with ≥6 cases: initial closed state; `open()` toggles `isEditing` true; `cancel()` resets `isEditing` to false and clears `error`; the returned `onSuccess` callback closes + calls `router.refresh()` when `onSuccessRefresh: true` (default); the returned `onError` callback sets `error` + keeps `isEditing` true; explicit override `onSuccessRefresh: false` skips `router.refresh()`.
- [ ] `apps/web/components/app/CareTeamList.tsx` refactored: ONLY `inviteMutation`'s edit-mode toggle migrates to `useEditMode`. `removeMutation` keeps its inline two-click confirm flow unchanged (different interaction pattern, not edit-mode). Existing tests green.
- [ ] `apps/web/components/app/EmergencyFooterCard.tsx` refactored: the single edit-mode `mutation` migrates. Existing tests green.
- [ ] **Concrete line-count gate:** measure baseline duplication. Today CareTeamList's invite edit-mode block spans ~lines 80-150 (~70 lines around state + open/cancel/submit/error/onSuccess); EmergencyFooterCard's edit-mode block spans ~lines 40-95 (~55 lines). Post-refactor: each component's edit-mode footprint drops by ≥15 lines; total net (hook + tests minus reduction) is ±20 lines acceptable.
- [ ] No behavior change: visible UI, success toast, error display, cancel behavior, `router.refresh()` timing — all identical. Spot-verify by running each component's existing tests + a manual `live-test` flow on each panel.
- [ ] `cd apps/web && npx eslint --quiet apps/web/hooks/useEditMode.ts apps/web/components/app/CareTeamList.tsx apps/web/components/app/EmergencyFooterCard.tsx` clean (catches React 19 react-hooks/purity issues that vitest misses — see project CLAUDE.md).
- [ ] `cd apps/web && npx tsc --noEmit` clean + full vitest suite green.

### Factory-pattern signature

```ts
type UseEditModeArgs = {
  onSuccessRefresh?: boolean; // default true
};

type UseEditModeReturn = {
  isEditing: boolean;
  error: string | null;
  open: () => void;
  cancel: () => void;
  // Compose into useMutation({ onSuccess, onError }) at the caller:
  handlers: {
    onSuccess: () => void;
    onError: (err: { message: string }) => void;
  };
};

export function useEditMode(args?: UseEditModeArgs): UseEditModeReturn;
```

Caller pattern:

```tsx
const editMode = useEditMode();
const inviteMutation = trpc.memberships.invite.useMutation({
  onSuccess: () => {
    editMode.handlers.onSuccess(); // closes + router.refresh()
    showToast("Invite sent");      // caller-specific side effect preserved
  },
  onError: (err) => {
    editMode.handlers.onError(err); // sets editMode.error
  },
});
```

This preserves each component's idiosyncratic side effects (toasts, telemetry) while DRYing the open/close/error/refresh state machine. The hook is generic-free (no `<TForm>`) because form state is owned by the caller (existing `useState` for form fields — unchanged).

### Files

**Owned (no other track touches these):**

- `apps/web/hooks/useEditMode.ts` (new)
- `apps/web/hooks/__tests__/useEditMode.test.tsx` (new)
- `apps/web/components/app/CareTeamList.tsx` (refactor only — no UI/copy changes)
- `apps/web/components/app/EmergencyFooterCard.tsx` (refactor only — no UI/copy changes)

### Risks

- **tRPC mutation API surface variance.** If `CareTeamList` and `EmergencyFooterCard` use different mutation patterns (e.g. one uses `onSuccess` callback config; the other uses `useEffect` on `status`), the hook signature must accommodate both. Read both files end-to-end before implementing.
- **router.refresh() timing.** Both components call `router.refresh()` post-success; centralizing in the hook is the value, but verify no component does additional work between success and refresh that the hook would clobber.

### Branch

`refactor/td-180-use-edit-mode-hook`

---

## Cross-track invariants

- **PHI rule (both tracks):** any analytics or Sentry/Resend calls touched MUST use anonymous UUID only — never email, name, phone, or PII.
- **No BACKLOG.md edits in either PR** (per BACKLOG-as-SoT; close via `/sprint` housekeeping).
- **Local green gates PR ready:** `cd apps/web && npx vitest run` + `pnpm lint` + `npx tsc --noEmit` before `gh pr ready`.

## Merge order

Independent — no soft dependencies. Either order works. Arm auto-merge on both at PR open; squash-merge.

## Wave dispatch shape

2 tracks × 2 PRs × parallel `Task` dispatch with worktrees (`.worktrees/td-181-eslint/` and `.worktrees/td-180-hook/`). Per global `## Parallel Work` and `## Worktree & Subagent Conventions`. Heartbeat contract: each subagent appends to `.claude/agent-status/<id>.log` every 5 min; orchestrator polls every 10 min.
