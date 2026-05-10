# Carelog — Roadmap, Backlog & Harness Audit (2026-05-09)

Read-only audit. No code edits. Triggered by user observation that backlog/plan items reference work that has been silently consolidated or abandoned (`/carezone-alternative` page no longer exists), and a request to assess harness effectiveness.

---

## Part 1 — Stale roadmap & backlog items

### A. `/carezone-alternative` page is gone — three docs still reference it

The page was folded into `/about` (per `docs/STATE_OF_PROJECT_2026-05-01.md:53`: "/compare + /carezone-alternative folded into /about (#316/#317)"). `apps/web/app/(marketing)/about/page.tsx` imports `CompareTable` and `CareZoneMedicationImport`. No `(marketing)/carezone-alternative/` directory exists.

Stale references:

| Where | Line | What it says | Fix |
|---|---|---|---|
| `BACKLOG.md` | §7 row ON-53 (line 68) | "✅ Shipped · PR #100 — `/carezone-alternative` hero, …; MarketingNav linked ('CareZone users')." | Append "consolidated into `/about` 2026-04 via #316/#317" so the shipped log reflects current truth. |
| `BACKLOG.md` | §1 row SEO-004 (line 141) | "key pages link to each other (`/` ↔ `/pricing` ↔ `/carezone-alternative` ↔ `/for-referrers`)." | Replace `/carezone-alternative` with `/about#compare`. |
| `docs/plans/post-wave-9-execution.md` | line 137 | `SEO-003 (HowTo JSON-LD) | (marketing)/about/page.tsx, (marketing)/carezone-alternative/page.tsx` | Drop the second target. (PR #386 already deferred SEO-003 partly for this reason.) |
| `docs/project-info/product/ROADMAP.md` | line 187 (Phase 6 SEO §) | "internal linking between marketing pages, the CareZone-comparison page, and `/for-referrers`" | "the CareZone comparison section on `/about`, and `/for-referrers`". |
| `apps/web/copy-audit.md` | lines 405, 427 | flags `(marketing)/compare/page.tsx` issues | Both `/compare` and `/carezone-alternative` are gone — these audit findings are stale; either re-run the audit against `/about` or strike them. |

### B. ROADMAP says "(not started)" for things that already shipped

| ROADMAP claim | Reality | Recommendation |
|---|---|---|
| Phase 1 — "Weekly digest (not started)" (line 40) | `apps/web/inngest/functions/weeklyDigest.ts` exists with two test files; ON-50 (PR #106) shipped meds adherence section; ON-59 (PRs #110/#111) shipped Sentry instrumentation + `cron_runs` timestamps | Mark Phase 1 weekly digest as **shipped**; move "(not started)" to whatever's actually next. |

### C. ROADMAP "Outer circle volunteer board" referenced as Phase 3 — backlog has it shipped

ROADMAP Phase 3 lists "Outer circle volunteer board" (line 100) without a status. BACKLOG §7 has multiple OuterCircle ships (component edits found in `OuterCirclePanel.tsx`). Worth marking on the roadmap for clarity; not a stale-row blocker.

### D. Shipped row scope drifted from row text

| Row | Says | Actually shipped | Action |
|---|---|---|---|
| ON-53 (BACKLOG §7) | "/carezone-alternative" page | Standalone page shipped 2026-04 PR #100, then consolidated into `/about` via #316/#317 | Append consolidation note. |
| ON-56 (§5 line 374-378) | "New marketing page at `/data-commitment` (or `/trust`)" | Lives at `/trust` only. `/data-commitment` doesn't exist. | Tighten row text to just `/trust`. |

### E. Ready rows that look stale enough to deprioritize or strike

| ID | Status | Why suspect |
|---|---|---|
| **UX-035** | 🟢 Ready — "Gate `BriefHero` mock content behind feature flag" | BriefHero may already be wired to real data via `briefs.dashboardSummary` (Wave 9). Verify whether `BriefHero.tsx` still has `TODO(UX-24+)` mock content. If real data is plumbed end-to-end, this row is obsolete. |
| **UX-053** | 🟢 Ready — "Empty-state pass" | The Hardening audit row from 2026-04-29; eight months between filing and now is a lot. Worth sampling `MedCard.tsx:154` again — pattern may have been fixed in a different sweep. |
| **SEO-006** | 🟢 Ready — "Cornerstone content engine + 3-5 articles at /learn/*" | ~8hr of copy-heavy long-form content writing. The plan itself notes "no dispatch — single creative voice matters here." Filed as Ready, but realistically blocks on you carving out a half-day to write. Move to 🧑 Needs human or 🧊 Deferred if not on the runway. |
| **TD-87** | 🟢 Ready — "Restore Lighthouse a11y gating in CI" | Filed 2026-04-29 with 3 forking solution paths. Decision-shaped, not implementation-shaped. Worth converting to a 🟡 Spike or appending the chosen path. |

### F. Duplicate rows (same outcome, two filings)

| Pair | Same outcome? | Action |
|---|---|---|
| **ON-55** + **ON-69** ("Visit recorder · Phase 7") | Both 🧊 Deferred, identical scope, identical "Phase 7" rationale | Strike one (keep the lower ID). |
| **UX-103/104/105** + **UX-066** | Both deal with RecipientProfile enrichment (caregivers join, schema for likes/dislikes/emergency info) | Same surface area. UX-066 was filed first (~04-30) and never split; UX-103/104/105 split it into 3 implementable rows on 2026-05-01. UX-066 should now be marked superseded by UX-103..105 or struck. |

### G. Roadmap ↔ memory ↔ backlog 3-way inconsistencies

- **Mobile**: Memory + BACKLOG say multiple Android/iOS QA items are shipped (PP-005 web push, PP-006 Android prebuild, PP-007 FCM, etc.). ROADMAP doesn't mention mobile QA/TestFlight cycle outside of LAUNCH-001. No action needed — that's the right shape — but noting that "mobile platform parity" reads more developed in BACKLOG than in ROADMAP.
- **CareSync 2.0 design** (memory `project_caresync_2_0_design.md`) says "Sage as additional theme (violet stays default)". Memory `project_caresync_handoff_session.md` says "Sage now default." These contradict — the second supersedes the first. **Lower-priority cleanup**: delete `project_caresync_2_0_design.md` from memory (or annotate as superseded). The system won't break, but a future Claude resolving "is Sage default?" via memory will get the wrong answer 50% of the time.

### H. Roadmap-flagged items missing or unaddressed in BACKLOG

These appear on ROADMAP as not-yet-built but have **no Ready row** tracking them — risk of them quietly disappearing:

- Phase 2 — **Coverage request board** (`coverage_windows` table) — never seen in shipped log. No backlog row.
- Phase 3 — **Refill alerts** Inngest job — no row.
- Phase 3 — **Prescription label scanning** OCR pipeline — no row.
- Phase 4 — **Burnout tracker** — no row (deliberately later, but no placeholder).
- Phase 4 — **Full history export** — no row.

Decision: either file Ready rows (with explicit "blocked by Phase X stable" if appropriate) so the BACKLOG covers what ROADMAP promises, or annotate ROADMAP that these are deliberately deferred and where to find the deferral note.

---

## Part 2 — Harness audit

### A. Critical bug — 9 hooks reference a path that doesn't exist

**`.claude/settings.json` has 9 references to `/Users/bradygrapentine/Documents/projects/carelog`. The repo lives at `/Users/bradygrapentine/projects/carelog`** (no `Documents/`). I confirmed `/Users/bradygrapentine/Documents/projects/carelog` is a stub directory with nothing in it.

What's broken because of this:

1. **pgTAP-on-RLS-edit hook** — runs `cd /Users/bradygrapentine/Documents/projects/carelog && supabase test db` after editing any auth/RLS/migration file. The `cd` fails silently or runs against the empty stub. The hook returns `|| true`, so the failure is invisible. **You haven't been getting pgTAP-on-edit feedback for any of Wave 6+.**
2. **Mobile typecheck-on-edit hook** — same pattern, same silent skip. Mobile edits in `apps/mobile/**` haven't been triggering tsc since the path went stale.
3. **6 permission allowlist entries** like `git -C /Users/bradygrapentine/Documents/projects/carelog rev-parse HEAD` — pre-grants for Bash patterns that never match the real path, so they're dead entries. Non-blocking, just noise.

Fix: global search/replace `Documents/projects/carelog` → `projects/carelog` in `.claude/settings.json`. Single PR, ~2 minutes, immediately restores the pgTAP and mobile-typecheck regression nets that have been silently inactive.

### B. Skill duplication — project shadows global; drift risk

Project has 28 skills; global has 50. **18 names overlap** (e.g. `backlog-sync`, `dispatch`, `tdd-ship`, `wave`, `schema-dump`, `live-test`, `ollama`, `pre-flight`, `session-end`, `ship-story`, `supabase-types`, `tdd-ship`). Project copies shadow global. The two diverge over time and you can't tell which Claude actually ran.

Recommendation: pick one home per skill.
- **Promote to global** anything portable: `live-test`, `schema-dump`, `dispatch`, `tdd-ship`, `session-end`, `ship-story`, `backlog-sync`, `pre-flight`, `routing-report`, `worktree-subagents`. Most of these are already in global — confirm the global is current, then **delete the project copy**.
- **Keep project-only** the things that genuinely encode carelog-specific flows: `create-migration` (pgTAP + Supabase patterns), `expo` (mobile), `mobile-ui` (iOS Simulator driving), `pr-review-agent`, `review` (PHI/RLS-aware), `sentry-triage`, `add-component` (project conventions), `deploy-autopilot` (Vercel + deploy runbook).

### C. Skill candidates to PROMOTE project → system

These project skills look generic enough that other Brady projects (20carat, etc.) would benefit:
- **`schema-dump`** — pre-migration schema snapshot. Already in global by name; verify the project version isn't Supabase-specific in a way the global version isn't.
- **`live-test`** — driving the live UI. Already global.
- **`worktree-subagents`** — pre-flight + scope contract template. Already global as `dispatch-preflight` / `subagent-heartbeat`. Project version may have superseded; consolidate.
- **`pr-review-agent`** — if not project-specific, promote.

### D. Skill candidates to REMOVE from project (use global)

Hard to fully judge without diffing each pair, but at minimum these names are duplicated in both places and the global version is the canonical one:

- `backlog-dispatch`, `backlog-sync`, `dispatch`, `live-test`, `ollama`, `plan-with-tests`, `pre-flight`, `routing-report`, `schema-dump`, `session-end`, `ship-story`, `skill-builder`, `supabase-types`, `tdd-ship`, `test-gaps`, `excalidraw-diagram`, `integration-nextjs-app-router`

For each: diff project vs global, take the better content as the global version, delete the project copy. Estimated effort: 1–2 hours of careful merging.

### E. Things in CLAUDE.md that are scar tissue (i.e. things that should not need to be there)

The "Known Gotchas" section (project `.claude/CLAUDE.md` lines ~46-55) and the parent root `CLAUDE.md` enhancement-trigger ritual document recurring breakages. Each of these is a sign the harness is fighting itself:

| Gotcha | Symptom | Right fix |
|---|---|---|
| "Pre-commit vitest flake on YAML/markdown-only diffs" | Hook flakes when no JS/TS changed | Make the pre-commit hook detect no-app-code-changed and skip vitest. |
| "Worktree commits + main-branch guard hook" | Hook checks harness-root cwd, not worktree cwd | Fix the guard to use `git -C "$(git rev-parse --show-toplevel)"`. |
| "Subagent context exhaustion mid-PR" | Subagent declares "completed" but no PR | Cap dispatched-subagent file count at 3, OR have the dispatch skill push after each commit, OR build a "subagent verifier" that confirms PR exists before declaring done. |
| "React 19 react-hooks/purity blocks Date.now() inside hooks" | Lint-only error, only surfaces in CI | Run `eslint --quiet` in pre-commit (the hook only runs vitest). |
| "Subagent dispatch prompt-too-long" (observed today) | Agent rejects ~300-word prompts because injected context is huge | Trim/chunk what's auto-injected into Agent dispatches. |

Fixing these would remove ~5 entries from the gotchas list, save real time per session, and simplify CLAUDE.md (which is currently 412 lines of project rules on top of 122 lines of global rules).

### F. CLAUDE.md is doing too much

`.claude/CLAUDE.md` (412 lines) bundles: hook docs, MCP setup, plugin priority, model routing, ollama dispatch matrix, branch hygiene, scope contracts, PHI rules, parallel-work rules, Mergify procedure, skill priority, agent contract. Each is useful in isolation; together it's a wall of text that:

- Always loads into context (~3-4k tokens of fixed overhead per session).
- Buries the actually-load-bearing rules (PHI, branch hygiene) under reference material.
- Has multiple sections that say similar things with slightly different wording (Subagent Dispatch Rules appears 2x; "Skills vs SDK Scripts" appears 2x in your global CLAUDE.md alone).

Recommendation: split CLAUDE.md into 3 files:
1. **`CLAUDE.md`** — only behavioral rules that change Claude's actions (PHI, branch hygiene, scope contract, no-mocking-in-RLS-tests). Target ~80 lines.
2. **`docs/project-info/runbooks/HARNESS_USAGE.md`** — already exists; move all the hook/mcp/skill/routing reference material here.
3. **`docs/project-info/CONVENTIONS.md`** — code style, commit format.

Claude reads CLAUDE.md every session; it reads runbooks on demand. Pushing reference material out cuts steady-state context and surfaces the rules that matter.

### G. Settings allowlist is bloated with stale entries

`.claude/settings.json` permissions list has ~26 entries, including 6 with the wrong path (Section A) and several that look ad-hoc (e.g. a specific multi-line `grep` against `journal/[recipientId]/TeamPanel.tsx`, `Bash(echo "EXIT:$?")`). Most of these were probably added during an interactive denial dialog and never cleaned up.

Recommendation: dedupe; remove the stale-path entries (Section A); collapse `Bash(echo "EXIT:$?")` / `Bash(echo "VITEST_EXIT:$?")` etc. into a single broad `Bash(echo:*)` entry.

### H. Hooks that are silently doing nothing

Beyond the broken-path ones (Section A):
- `Bash(npx tsc --noEmit)` PostToolUse hook **only inspects `apps/web`** — every edit triggers a full web typecheck even for `supabase/`-only changes. ~2-5s per edit, multiplied across a session. Worth scoping to only fire when the edited file is under `apps/web/**`.
- ESLint hook similarly runs full-cache lint on every edit. Same scope-down opportunity.
- `related-test.sh` PostToolUse hook is project-only, valuable, working — keep.
- The `[hint] run /review before merging` hint hook fires on every Bash with `gh pr create` — useful, keep.

### I. Things the global harness has that this project should adopt

| Global skill | Why it'd help here |
|---|---|
| `verify-before-commit` | Would catch the "subagent says done, no PR exists" failure mode I logged in memory. |
| `subagent-heartbeat` | Already referenced in `/wave` skill but the project doesn't have a skill version. Promote. |
| `codex-adversarial-gate` | Already used (`.codex-runs/` dir exists). Confirm wired into the project's `/wave` flow. |
| `migration-safety` | Layer on top of `create-migration` — explicit pre-write schema dump + post-write rollback verification. |
| `perf-regression-gate` | Plan referenced this; verify it actually runs against SEO-005 work. |

### J. Memory hygiene

15 memory files. Two are stale or contradicted:

- `project_caresync_2_0_design.md` (Sage as alt theme) is contradicted by `project_caresync_handoff_session.md` (Sage now default). Strike or annotate.
- `session_2026-04-17-dispatch.md` is a session log — these were called out in the "What NOT to save in memory" section of the auto-memory rules ("Ephemeral task details: in-progress work, temporary state, current conversation context"). Worth striking.

---

## Recommended next actions, in priority order

1. **Fix the 9 stale-path hooks** in `.claude/settings.json`. ~5 min. Restores pgTAP-on-edit + mobile-typecheck regression nets. **Highest ROI item in the entire audit.**
2. **One small chore PR** to fix the stale `/carezone-alternative` references in BACKLOG.md (rows ON-53, SEO-004), `docs/plans/post-wave-9-execution.md` line 137, and ROADMAP line 187. ~10 min.
3. **Mark ROADMAP "Weekly digest (not started)" as shipped.** ~2 min.
4. **Strike duplicate rows ON-55/ON-69, UX-066 vs UX-103..105.** ~5 min in a backlog-sync-style chore PR.
5. **Decide on UX-035 / UX-053 / SEO-006 / TD-87** (Section E) — verify against current code, then either close or move to a more honest status.
6. **Skill dedup** — diff each duplicated project skill against its global twin, keep the better one in global, delete the project copy. ~1-2 hr.
7. **CLAUDE.md split** (Section F) — drop steady-state context overhead. ~30 min.

Items 1, 2, 3 are pure documentation/config; can ship in 30 minutes total and the audit pays for itself.
