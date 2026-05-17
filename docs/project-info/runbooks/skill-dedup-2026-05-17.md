# Skill Dedup Phase 2 — 2026-05-17

TD-111 triage of project-local skills (`.claude/skills/`) against global counterparts (`~/.claude/skills/`).

## Reconciliation

`ls .claude/skills/` at start of run (authoritative): **11 project skills** (plan estimated 13 — 2 names from plan row didn't exist on disk: `backlog-dispatch`, `ollama`; `plan-with-tests`, `session-end`, `supabase-types` also absent — those were already cleaned in Phase 1 or never existed at this layer).

Actual list: `deploy-autopilot`, `dispatch`, `expo`, `live-test`, `mobile-ui`, `review`, `schema-dump`, `sentry-triage`, `ship-story`, `tdd-ship`, `test-gaps`

## Triage Table

| Skill | Global exists? | Decision | Rationale |
|---|---|---|---|
| `deploy-autopilot` | No | **KEEP** | Carelog-specific deploy workflow (Vercel + Supabase + Sentry config); no global equivalent. |
| `dispatch` | Yes | **DELETE** | Project version has outdated `--from-backlog`/`backlog-dispatch` mode; global uses `/sprint` pipeline (correct). Caller scan: callers in docs reference `/dispatch` by name — global covers behavior identically. |
| `expo` | No | **KEEP** | Carelog `apps/mobile/` Expo Router + deep-link patterns; no global equivalent. |
| `live-test` | Yes | **RENAME → `live-test-carelog`** | Project version adds TD-48 origin story, `Carelog`/`CareSync` brand mention, carelog-specific CLI invocations (`scripts/live-test.mjs`), and carelog-specific "When to use" examples. Runbooks + plan docs reference `/live-test` by name for CareSync-specific flows; keeping the carelog overlay is correct. |
| `mobile-ui` | No | **KEEP** | iOS Simulator + Android emulator driver for Carelog mobile; no global equivalent. |
| `review` | No | **KEEP** | Carelog adversarial security review with 3-subagent pattern scoped to Carelog RLS / tRPC / PHI data model; no global equivalent. |
| `schema-dump` | Yes | **DELETE** | Project version is identical in function; global adds "abort if no Postgres reachable" guard that project lacks — global is strictly better. Caller scan: callers reference `/schema-dump` — global covers behavior. No promotions needed (global already has it). |
| `sentry-triage` | No | **KEEP** | Carelog Sentry org/project config + BACKLOG row synthesis for CareSync incidents; no global equivalent. |
| `ship-story` | Yes | **RENAME → `ship-story-carelog`** | Project version hard-codes `cd apps/web && npx vitest run --reporter=dot` and `cd apps/web && npx tsc --noEmit` (correct for Carelog) and has explicit Carelog PHI note in PR template. Global is generic (reads project CLAUDE.md). Project version is more authoritative for Carelog workflows. |
| `tdd-ship` | Yes | **DELETE** | Global has Stage 4.5 (adversarial gate) and Stage 6 (CI closed loop) that project version lacks — global is strictly better. Project's only carelog-specific content is the PHI check phrasing, already covered by `.claude/CLAUDE.md`'s PHI rule which all skills inherit. Caller scan: callers use `/tdd-ship` by name — global covers. |
| `test-gaps` | Yes | **RENAME → `test-gaps-carelog`** | Project version adds Carelog-specific severity buckets: Critical (PHI boundaries, auth, billing), High (business logic mutations), Medium (UI), Low (utilities). These align to Carelog's risk model and aren't in the global skill. |

## Summary

- **Deleted:** `dispatch`, `schema-dump`, `tdd-ship` (3)
- **Renamed:** `live-test` → `live-test-carelog`, `ship-story` → `ship-story-carelog`, `test-gaps` → `test-gaps-carelog` (3)
- **Kept (project-only):** `deploy-autopilot`, `expo`, `mobile-ui`, `review`, `sentry-triage` (5)
- **Promoted:** none
- **Total processed:** 11 project skills

## Caller Scan Results

All deleted skills confirmed safe to delete:

- `/dispatch` — callers in `.claude/skills/dispatch/SKILL.md` (now deleted), docs. Global `dispatch` covers behavior.
- `/schema-dump` — callers in `.claude/skills/ship-story/SKILL.md`, `.claude/skills/tdd-ship/SKILL.md` (now deleted/renamed), docs. Global `schema-dump` covers behavior.
- `/tdd-ship` — callers in docs/design plan files (descriptive references, not invocations). Global `tdd-ship` covers behavior.

No promotion verification gate required (no promotions performed — global already had all three deleted skills).
