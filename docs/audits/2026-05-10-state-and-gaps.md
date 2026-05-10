# Carelog state & gaps audit — 2026-05-10

Triggered by user request: "clean up old branches and changes; address test gaps; address TODOs; investigate for missed requirements; update the roadmap; update documentation."

Sections:
- §1 Workspace cleanup (done)
- §2 TODO survey
- §3 Test-coverage gaps
- §4 ROADMAP drift — what's shipped vs what the doc claims
- §5 Missed requirements (none material; details inside)
- §6 Documentation update proposals

---

## §1 Workspace cleanup — DONE in PR #403

- 17 merged-gone local branches deleted (`git branch -D` on the `: gone` set).
- 6 untracked legitimate docs committed: `CLAUDE.md`, `CONTEXT.md`, `docs/audits/2026-05-09-roadmap-and-harness-audit.md`, `docs/plans/audit-remediation-2026-05-09.md`, `docs/plans/wave-13-phi-brand-tier1-tests.md`, `docs/project-info/runbooks/SUPABASE_ENV_DRIFT.md`.
- `.gitignore` extended: `.codex-runs/` + `.vercel/`.
- Worktree list = main only. Status clean.

---

## §2 TODO survey

Source-tree scan (`rg "\bTODO\b|\bFIXME\b|\bXXX\b|\bHACK\b"`):

| Surface | Count | Notes |
|---|---|---|
| `apps/web/{server,lib,components,app}` (excluding tests) | **0** | clean |
| `apps/mobile/__tests__/a11y/` | 10 | all reference **A11Y-006** — already a tracked backlog row |
| `supabase/` | 0 | clean |

**Action:** none. The mobile a11y TODOs are already governed by row A11Y-006 in BACKLOG.md.

---

## §3 Test-coverage gaps

Direct-test coverage scan (filename match + `from`-import scan against `__tests__/`):

### Real gaps — file your own follow-up rows for these

| File | Surface | Risk | Recommended row |
|---|---|---|---|
| `apps/web/server/repositories/careEventCommentsRepository.ts` | Comment threads on care events (PHI-adjacent — comments contain caregiver narrative) | **Tier 1** (PHI write path) | TD-113 |
| `apps/web/server/repositories/medicationTaggingRepository.ts` | Auto-tagging events to `medication_id` for adherence math | **Tier 2** (data integrity) | TD-114 |
| `apps/web/server/repositories/shiftTradeRequestsRepository.ts` | Shift trade flow — claim/approve/decline state transitions | **Tier 2** (auth-adjacent: who can approve) | TD-115 |
| `apps/web/server/routers/moodEntries.ts` | Mood logging via tRPC — direct PHI write path | **Tier 1** (PHI write path) | TD-116 |

Notes:
- `medicationTagging.precision.test.ts` exists but covers only the precision/recall of the matching algorithm; the repository CRUD path itself is untested.
- All four are server-side, RLS-fenced — DB integrity is enforced. Tests would catch repository-helper-layer regressions (org/recipient boundary in queries, error handling, race conditions).

### Verified covered (false alarms from naive filename match)

- `membershipsRepository.ts` → `membershipsRepository.test.ts` ✅
- `lib/offline-queue.ts` → `lib/__tests__/offline-queue.test.ts` ✅

### Recommendation

File **TD-113..116** as a single backlog PR, then schedule a Wave 14 to write the four test files. Same pattern as the (already-shipped) TD-78..82 Tier-1 testing wave. Estimated effort: ~6 hr for all four.

---

## §4 ROADMAP drift — significant

`docs/project-info/product/ROADMAP.md` is materially out-of-date. Verified shipped state vs. current ROADMAP claims:

| Roadmap phase | Item | ROADMAP says | Actual state |
|---|---|---|---|
| Phase 1 spine | Care journal | done ✅ | shipped ✅ |
| Phase 1 spine | Team coordinator | "in progress" | **shipped ✅** (memberships + roles + invites + admin all live) |
| Phase 1 spine | Weekly digest | shipped ✅ | shipped ✅ |
| Phase 2 scheduler | Shift management | no status | **shipped ✅** (shifts + ShiftsPanel + 6 layout tabs) |
| Phase 2 scheduler | Coverage windows | no status | **shipped ✅** (`coverage_windows` migration `20260409` + ShiftCalendar) |
| Phase 2 scheduler | Handoff notes | no status | **shipped ✅** (`shifts_handoff_entries` migration `20260508` + NarrativeHandoff) |
| Phase 3 medical | Medication catalog | no status | **shipped ✅** (medications table + MedicationPanel) |
| Phase 3 medical | OCR scanning | no status | **shipped ✅** (`ocr_jobs` + Inngest pipeline + review UI) |
| Phase 3 medical | Refill alerts | no status | **shipped ✅** (`apps/web/inngest/functions/refillAlert.ts`) |
| Phase 3 medical | Outer circle | shipped ✅ | shipped ✅ |
| Phase 3 medical | Care brief | no status | **shipped ✅** (`/brief/[shareToken]` + DOB-gated as of UX-045) |
| Phase 4 depth | Symptom tracker | no status | **shipped ✅** (SymptomPanel + symptoms router) |
| Phase 4 depth | Burnout tracker | no status | **shipped ✅** (BurnoutCheckin + BurnoutOrgSummary + Inngest alert) |
| Phase 4 depth | Full history export | no status | **shipped ✅** (`/api/history/export/pdf`) |
| Phase 4 depth | Visit recorder | "Phase 7, future" | **migration shipped** (`visit_recordings` `20260501`) — UI status uncertain |
| Phase 5 financial | Shared expense log | no status | **shipped ✅** (ExpensePanel) |
| Phase 5 financial | Benefits navigator | no status | **shipped ✅** (route + tests visible) |
| Phase 5 financial | Document vault | no status | **shipped ✅** (`/api/documents/*` upload + download) |
| Phase 5 financial | EOL planner | no status | **shipped ✅** (EolPlanner + tests) |
| Phase 6 launch | OG/sitemap/robots/JSON-LD | LAUNCH-003 shipped | shipped ✅ |
| Phase 6 launch | Sentry source-map upload | "post-launch" wired | **mostly wired** — `withSentryConfig` present in `apps/web/next.config.ts`; `SENTRY_AUTH_TOKEN` provisioning still TD-03 (human-gated) |
| Phase 6 launch | Rate-limit 429 monitor | TD-73 not started | **shipped ✅** (`apps/web/inngest/functions/rateLimit429Monitor.ts`) |

**Summary:** The ROADMAP frames Carelog as mid-Phase-1. In reality Phases 1–5 are all substantially shipped. The current product is much further along than the doc admits. Remaining real gaps live in the BACKLOG (UX polish, accessibility, observability hardening, mobile parity).

---

## §5 Missed requirements

Cross-checked the BACKLOG §1 Ready rows + §8 (Needs human) + ROADMAP "Phase 6 — Launch readiness" against shipped code. Findings:

1. **Visit recorder UI** — `visit_recordings` migration shipped 2026-05-01 but no `apps/web/app/api/visit*` route surfaced in the scan. The recorder may be mobile-only or may be schema-without-UI. Worth a triage row.
2. **`SENTRY_AUTH_TOKEN`** — wiring is in place; TD-03 is correctly flagged 🧑 Needs human (Vercel env var). No drift.
3. **HIPAA BAA + privacy/terms** — LAUNCH-005 is correctly flagged 🧑. No drift.
4. **Mobile App Store launch (LAUNCH-001)** — 🧑 human-gated, EAS production build outstanding. No drift.
5. **caresync.app DNS** — UX-051 deferred this session pending DNS. No drift.

**No silent missed requirements.** The BACKLOG accurately tracks the open work; the ROADMAP just under-reports completion.

Suggested **new** rows:
- **TD-113..116**: the test-coverage gaps from §3.
- **UX-107**: triage/decide visit-recorder UI status (route or mobile-only? is `visit_recordings` populated yet?).

---

## §6 Documentation update proposals

Three docs are stale relative to shipped state. None of these need new content — they need the existing shipped state surfaced honestly.

### 6.1 `docs/project-info/product/ROADMAP.md` — full rewrite (HIGH priority)

Restructure as:
- **Phase 1 (shipped)** — care journal · team coordinator · weekly digest. All ✅.
- **Phase 2 (shipped)** — shifts · coverage windows · handoff notes. All ✅.
- **Phase 3 (shipped)** — medication catalog · OCR · refill alerts · outer circle · care brief. All ✅.
- **Phase 4 (shipped)** — symptom · burnout · full history export. ✅. Visit recorder = schema-only, UI status TBD.
- **Phase 5 (shipped)** — expenses · benefits · document vault · EOL planner. All ✅.
- **Phase 6 (in progress)** — launch readiness. Most engineering work shipped (sentry · rate-limit monitor · OG/sitemap/JSON-LD); remaining work is human-gated (LAUNCH-001 mobile App Store, LAUNCH-005 BAA/legal, TD-03 SENTRY_AUTH_TOKEN env, UX-051 DNS).
- **Beyond Phase 6** — UX polish (`UX-*` rows), accessibility hardening (`A11Y-*`), observability (`TD-7x`).

Sequencing rationale section — keep verbatim. "What we will NOT build" — keep verbatim.

### 6.2 `BACKLOG.md` — add new rows for §3 + §5 follow-ups

Single chore PR adding TD-113..116 (test gaps) + UX-107 (visit recorder UI triage). Update §0 Ready count.

### 6.3 `apps/web/CLAUDE.md` — minor (LOW priority)

Currently says "961 tests" in the test-suite reference (line 60-ish region). Actual current count: **1903 vitest tests across 242 files** (from this session's pre-commit gate). One-line update.

### 6.4 No edits needed

`CLAUDE.md` (root + `.claude/`), `PRODUCT.md`, `DESIGN.md`, `apps/mobile/CLAUDE.md`, `supabase/CLAUDE.md`, `e2e/CLAUDE.md`, all runbooks under `docs/project-info/runbooks/` — accurate or non-stale per spot checks.

---

## Recommended ship sequence

1. **PR #403** (already open, queued) — workspace cleanup ✅
2. **New PR** — ROADMAP rewrite per §6.1 (single doc, ~80 line rewrite of phase-status section + replace claims with shipped-anchor cites)
3. **New PR** — BACKLOG rows: file TD-113..116 + UX-107 per §6.2
4. **New PR** — `apps/web/CLAUDE.md` test count refresh per §6.3
5. **Wave 14 (later)** — implement TD-113..116 four-test-file dispatch (mirrors the shipped TD-78..82 wave)

PRs 2–4 are pure docs and can land in parallel.
