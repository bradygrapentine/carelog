# Non-memberships parallel wave — 2026-05-17

Four independent tracks dispatched in parallel via `/wave parallel`. No file overlap between tracks; each owns disjoint paths. Each opens its own PR; auto-merge armed at open.

E2E precondition waived per TD-170 (chronic-red main CI).

## Track A — TD-153 Path A: runbook reconcile

**Goal.** Rewrite `docs/runbooks/post-sec-001-happy-path.md` §2 to match current production state. The runbook currently describes screens that no longer exist (Stripe Checkout "Choose a plan" step, `/journal` and `/medications` routes, team-invite UI in Settings) and the wrong auth mode (magic-link instead of 6-digit OTP). Live-tests against it SKIP noisily.

**Branch.** `chore/td-153a-runbook-reconcile`

**Files allowed.**
- `docs/runbooks/post-sec-001-happy-path.md`

**Files OUT of scope.**
- Any source code under `apps/`. This is a doc-only reconcile; if a screen is missing, we update the runbook to match prod, not the other way around. Path B (rebuild screens) is separate.

**Acceptance.**
1. §2 happy-path steps describe: passwordless 6-digit OTP sign-in (not magic-link); dashboard as the primary care surface (no `/journal` link, no `/medications` link); Settings has Profile/Notifications/Language/Refer/Danger zone tabs only (no team-invite tab); no Stripe Checkout step.
2. A short "Out-of-scope" callout names the removed screens and points to TD-153 for Path B (rebuild decision).
3. Anchor preservation. First action of the subagent: `grep -rn "post-sec-001-happy-path" e2e/ scripts/ .claude/skills/ docs/` to find any consumer that greps the runbook by heading text. If none found, record `No live-test consumers — anchor preservation trivially satisfied` in the PR body and proceed. If consumers exist, preserve the exact heading strings they grep.

## Track B — TD-147: canonical decision-doc surface

**Goal.** Pick one canonical surface for "what was decided" and document the convention. Three competing surfaces today: `docs/adr/` (architecture), `docs/project-info/product/UX_DECISIONS.md` (UX/language), and the "Guiding decisions (decide once, applies everywhere)" section in `docs/plans/audit-remediation-2026-05-09.md`.

**Decision.** Two canonical surfaces by intent — **NOT** one. Rationale: ADRs encode architecture/system-design tradeoffs (audience: future engineers reading code); UX_DECISIONS encodes product-language/tone (audience: future engineers writing copy + product folk). Different cadences, different review processes, different consumers. Conflating them buries each in the noise of the other.

The third surface (`audit-remediation-2026-05-09.md` "Guiding decisions") is a plan-embedded artifact and should not be canonical. Migrate any still-load-bearing entries to ADR or UX_DECISIONS; strike the rest.

**Branch.** `chore/td-147-canonical-decision-docs`

**Files allowed.**
- `/Users/bradygrapentine/projects/carelog/CLAUDE.md` (**root project CLAUDE.md, NOT `.claude/CLAUDE.md`** — add a brief "Decision docs" section naming the convention. Root file is ~69 lines today; +8 lines is safe under the 200-line cap. Do NOT touch `.claude/CLAUDE.md` which is at 159 lines and would breach the cap.)
- `docs/adr/README.md` (clarify scope; reference UX_DECISIONS as the sister surface)
- `docs/project-info/product/UX_DECISIONS.md` (header note: this is the canonical product-decision surface; reference ADRs as the sister surface)
- `docs/plans/audit-remediation-2026-05-09.md` (migrate or strike "Guiding decisions" section; leave a one-line pointer + audit trail)

**Files OUT of scope.**
- Any source code. Any *other* ADR or doc. Don't sweep the rest of `docs/` looking for decision-flavored content; this is convention-setting, not migration cleanup.

**Acceptance.**
1. `CLAUDE.md` has a "Decision docs" section: ADR for architecture, UX_DECISIONS for product/language, both linked.
2. `docs/adr/README.md` and `UX_DECISIONS.md` each have a header note pointing at the other as the sister canonical surface.
3. The plan's "Guiding decisions" section is migrated (entries land in ADR or UX_DECISIONS as appropriate) or struck with explanation.
4. CLAUDE.md still ≤200 lines.

## Track C — TD-111: skill dedup phase 2

**Goal.** Triage the 13 divergent project-local skills against their global counterparts. For each: identical-after-format → delete project; project encodes carelog-specifics → rename to `<name>-carelog`; project genuinely better → promote to global + delete project.

**Branch.** `chore/td-111-skill-dedup-phase-2`

**Files allowed.**
- `.claude/skills/<name>/SKILL.md` for the project-local skills with global counterparts. Authoritative list is from `ls .claude/skills/` (acceptance item 6); the TD-111 row's reference count ("13 divergent") is informational and supersedes-by-disk. Starting set named in the row: `backlog-dispatch`, `backlog-sync`, `dispatch`, `live-test`, `ollama`, `plan-with-tests`, `schema-dump`, `session-end`, `ship-story`, `supabase-types`, `tdd-ship`, `test-gaps` — verify against `ls` before scoping.
- `~/.claude/skills/<name>/SKILL.md` ONLY if a project-skill is being promoted to global. Note these are outside the repo and **cannot be committed**; promotion = manual file move outside the PR, with the PR containing only the project-skill deletion + a short note in the PR body about which were promoted.
- A new `docs/project-info/runbooks/skill-dedup-2026-05-17.md` capturing the per-skill triage decision (kept / renamed / promoted / deleted, with one-sentence rationale). **Path: `docs/project-info/runbooks/` is the canonical home for process/harness runbooks; `docs/runbooks/` is reserved for live-test playbooks (Track A's file lives there as an exception).**

**Files OUT of scope.**
- Any app source code. Any skill not on the 13-name list. Any global skill not paired with a project-skill change.

**Acceptance.**
1. Per-skill triage table in `docs/project-info/runbooks/skill-dedup-2026-05-17.md`.
2. Project-side `.claude/skills/<name>/SKILL.md` deletions or renames per triage.
3. PR body lists any promotions performed (out-of-band file moves), so reviewers can verify in `~/.claude/skills/`.
4. **Promotion verification (hard gate, before any deletion).** For every skill marked "promote to global": `test -f ~/.claude/skills/<name>/SKILL.md` MUST succeed AND `diff <project-skill> <global-skill>` MUST match (or differ only in path comments) BEFORE the project copy is deleted. If the global copy doesn't exist yet, do the manual file move first, verify with `ls`, then proceed. Subagent brief must include the exact verify command.
5. **Caller scan before deletion.** For every skill being deleted (not renamed/promoted), `grep -r "/<name>" .claude/ scripts/ docs/ ~/.claude/skills/` must show no slash-command invocations that rely on the project version's behavior. (The grep pattern is `/<name>` not `skills/<name>` — slash commands are invoked as `/<name>`, not by file path.)
6. **Skill count reconciliation step.** First action of the subagent: `ls .claude/skills/` to get the actual count, compare against the 12 names listed (`backlog-dispatch`, `backlog-sync`, `dispatch`, `live-test`, `ollama`, `plan-with-tests`, `schema-dump`, `session-end`, `ship-story`, `supabase-types`, `tdd-ship`, `test-gaps`), reconcile any drift, record in the triage doc before starting work. The TD-111 row says "13" but the actual repo has 11 or 12; trust `ls` not the row.

## Track D — UX-065: BriefingHandoff narrative adapter

**Goal.** Build a server-side adapter that turns the prior shift's `care_events` into 3 one-line narratives (`sleep`, `meds`, `schedule`), and mount Briefing as a 4th tab in `ShiftsPanel` alongside the existing Calendar / Lanes / Now tabs (from UX-062).

**Branch.** `feat/ux-065-briefing-handoff-narrative`

**Files allowed.**
- `apps/web/lib/handoffNarrative.ts` (new) — pure functions: `summarizeSleep(events): string`, `summarizeMeds(events): string`, `summarizeSchedule(events): string`. Imports `JournalEvent` type from `apps/web/types/journal.ts`. **Pure: no `Date.now()`, no `Math.random()`, no I/O.**
- `apps/web/lib/__tests__/handoffNarrative.test.ts` (new) — table tests covering: zero-events case, single-event, multi-event aggregation, missing/given med counts, malformed payload graceful-fallback (returns `"No <category> recorded"` not throw).
- `apps/web/components/shifts/ShiftsPanel.tsx` (extend) — add a 4th tab "Briefing"; render `BriefingHandoff` component when active.
- `apps/web/components/shifts/BriefingHandoff.tsx` (new) — **client component** (sibling to existing ShiftsPanel children). Uses the existing `careEvents.getTimeline` tRPC query (already consumed by JournalClient — confirm via grep before using) to fetch `care_events` for the recipient over the prior-shift window; computes the 3 narrative strings inline via the `handoffNarrative` helpers; renders them. Loading/error states present (skeleton + retry button per the tinted-CardHeader pattern in `.claude/rules/ui-standards.md`).
- `apps/web/components/shifts/__tests__/BriefingHandoff.test.tsx` (new) — render test (happy path with mocked tRPC), loading-state test, error-state test, accessibility test (heading hierarchy + tab semantics + tab-target ≥40×40 per UI standards).

**Files OUT of scope.**
- Any tRPC router. Any Supabase migration. Any change to `JournalEvent` or `care_events` schema. Any UX work on tabs other than adding the new one.

**Acceptance.**
1. Three `summarizeX` functions implemented with table-test coverage including the zero-events case.
2. `ShiftsPanel` shows 4 tabs (Calendar / Lanes / Now / Briefing); existing 3 unchanged.
3. `BriefingHandoff` renders the 3 lines; heading + tab role correct per `.claude/rules/ui-standards.md`.
4. Narrative strings are **deterministic** for the same input — no `Date.now()` inside pure functions (React 19 react-hooks/purity).
5. No PHI in any analytics call. No raw med names, sleep details, or narrative strings in PostHog OR Sentry. The ESLint `carelog/no-phi-in-analytics` rule covers PostHog/Sentry object-literal calls but NOT spread/variable refs — for Sentry specifically: any `Sentry.captureException` in BriefingHandoff or its error boundary MUST pass error objects only, never user-data context, narrative-string `extras`, or `setUser` payloads. Reviewer scans the diff for `Sentry.` calls and verifies.
6. **4-tab layout fit at 375px** (acceptance, not just risk). Subagent must screenshot or describe the rendered tab row at viewport 375px before declaring done. Touch targets ≥40×40 per ui-standards. If overflow, the brief approves a horizontal-scroll-on-mobile fallback over hiding tabs.
7. Existing test suite stays green (typecheck + full vitest).

**Risk callouts (D-specific).**
- This is the only track shipping app code → only track that triggers Vercel Production deploy on merge to main.
- ShiftsPanel currently has 3 tabs in mobile-tight layout; verify 4-tab fit at 375px.
- PHI rule: narrative strings DISPLAY meds/sleep events; that's product. Analytics events fired from BriefingHandoff (if any) must use UUID only.

## Dispatch contract

Each track gets a separate subagent with its full `Files allowed` + `Files OUT of scope` + branch + acceptance carried verbatim into its prompt. Per global subagent-dispatch rules: branch name explicit; base SHA confirmed before each subagent starts; heartbeat-tracked.

Merge order: independent — any order is fine since file ownership is disjoint. Auto-merge armed on each PR at open.

## Risks accepted

- E2E precondition waived (TD-170 chronic-red).
- /owasp pre-plan skipped — no track touches auth/middleware/payment/upload/migration surfaces; PHI display in D is product, not analytics leak.
- /oop post-implementation runs on D only (the only track with app code).
