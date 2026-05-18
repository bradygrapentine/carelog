# Roadmap → Backlog Cascade Audit

**Date:** 2026-05-18
**Source:** `docs/project-info/product/ROADMAP.md` (267 lines, last updated 2026-05-10)
**Target:** `BACKLOG.md` (1298 lines)
**Mode:** read-only verification — no edits performed
**Trigger:** user-requested formal re-audit before `/sprint` on TD-87

## Verdict

**Cascade is complete.** Every open story in the roadmap has a tracking row in BACKLOG.md. No roadmap promise is orphaned. Two reverse-direction drifts surfaced (roadmap text is stale vs. backlog reality) — listed in §4 below; these are roadmap-edit candidates, not backlog gaps.

## 1. Phase coverage matrix

| Phase | Roadmap status | Backlog rows | Cascade state |
|---|---|---|---|
| Phase 1 — spine (journal, team, weekly digest) | ✅ Shipped | ON-49, ON-50, ON-51, ON-52, ON-57, ON-58, ON-59 (all §7) | ✅ complete |
| Phase 2 — scheduler (shifts, coverage board, handoff) | ✅ Shipped | shifts shipped pre-backlog; **ON-70 (coverage request board) 🟢 Ready** | ✅ complete |
| Phase 3 — medical (catalog, OCR, refill, brief, outer circle) | ✅ Shipped | catalog/OCR/brief shipped; **ON-71 ✅ Shipped 2026-05-17 PR #599** | ✅ complete |
| Phase 4 — depth (symptom, burnout, history export, visit recorder) | ✅ mostly shipped; visit recorder UI deferred | **ON-55 🧊 Deferred (UI surface); ON-74 🟢 Ready (history export); ON-73 🧊 Deferred (burnout 2nd pass)** | ✅ complete |
| Phase 5 — financial & legal (expenses, benefits, vault, EOL) | ✅ Shipped | all shipped pre-backlog | ✅ complete |
| Phase 6 — launch readiness | in progress (mostly human-gated) | LAUNCH-001..005, SEO-005/006/007, TD-03 | ✅ complete (see §3) |
| Beyond Phase 6 — open follow-ups | enumerated in roadmap lines 220–227 | 50+ rows across UX-*/A11Y-*/TD-*/PP-* | ✅ complete |

## 2. Roadmap-explicit row checklist

Roadmap lines 220–227 ("Beyond Phase 6") name these explicitly. All present:

- **UX polish** — `UX-046` (clinician-share spike, 🟡), `UX-077`, `UX-103b`/`105b` (shipped), `UX-049/050` (shipped) — confirmed
- **A11Y rows + TD-87 spike** — TD-87 🟡, A11Y-018 🧑 (residual VoiceOver) — confirmed
- **Tech debt + observability** — TD-113/114/115/116 (all ✅ shipped), TD-111 (✅ shipped via PR #584), TD-87 spike pending — confirmed
- **Mobile parity** — PP-009 (Android visual QA) 🟢 Ready — confirmed
- **Roadmap-promised** — ON-70 🟢, ON-71 ✅ shipped, ON-74 🟢 — confirmed

## 3. Phase 6 row map

| Roadmap item | Backlog row | Status |
|---|---|---|
| Mobile App Store launch (LAUNCH-001) | LAUNCH-001 | 🧑 Needs human — TestFlight + App Store Connect |
| EAS production build (LAUNCH-002) | LAUNCH-002 | ✅ Shipped PR #225 |
| Web go-live (LAUNCH-003) | LAUNCH-003 | ✅ Shipped PR #226 |
| Observability (LAUNCH-004 + TD-03) | LAUNCH-004 / TD-03 | ✅ Shipped (runbook) / 🧑 Sentry env var |
| Compliance & legal (LAUNCH-005) | LAUNCH-005 | 🧑 Needs human — privacy/ToS/BAA |
| SEO discoverability (SEO-001..007) | SEO-001/002/003/004/005/006/007 | 001/002/004/005 shipped; 003 deferred; 006/007 🧑 |

## 4. Reverse-direction drift (roadmap text is stale)

These are roadmap doc edits, not backlog gaps. Out of scope for this cascade pass — flag for a future roadmap-refresh PR.

1. **Roadmap line 218** ("Remaining work: SEO-005 …") — SEO-005 shipped 2026-05-17 via PR #588. Roadmap should flip to "SEO-005 shipped 2026-05-17; SEO-006/007 remain 🧑."
2. **Roadmap line 227** lists "refill alert delivery polish (ON-71)" as still open in the "but-not-yet-needed" list. ON-71 Phase 2 shipped 2026-05-17 via PR #599. Roadmap should flip ON-71 to shipped + reference the new follow-ups ON-71c (opt-out) and ON-71d (bounce handling) as the actual open work.
3. **Roadmap line 3** ("Status as of 2026-05-10") is 8 days stale. Recent shipped phases would benefit from a status refresh now that Sprints 1–3 of 2026-05-17 cleared 13 rows.

## 5. Spikes inventory

Three open spikes in §0 status board:

| ID | Story | Decision required |
|---|---|---|
| **UX-046** | Clinician-readable share surface | Founder/PM: pick (a) `visit-summary` token URL, (b) new `/clinician/[shareToken]`, or (c) reuse `/brief/[shareToken]` |
| **TD-87** | Lighthouse a11y CI gating | Pick (a) Vercel preview password-off, (b) Playwright-served local build, or (c) post-deploy job against production |
| **TD-157** | OTP fresh-request session-revoke repro | XS — empirical repro of Cowork-flagged scenario 5 |

## 6. Recommendation

Cascade is healthy — no `chore(backlog)` PR is needed today. The two roadmap-edit drifts in §4 could be batched into a separate `docs(roadmap)` PR if/when the user wants to refresh the roadmap doc; they do not block any backlog work.

Proceeding to `/sprint` on TD-87 per user direction. The Lighthouse a11y gate spike was specifically called out in roadmap line 224 ("`TD-87` Lighthouse a11y path") as the residual A11Y unblocker — strong alignment with "unblock future work."
