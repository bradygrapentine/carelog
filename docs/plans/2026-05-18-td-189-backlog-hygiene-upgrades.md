# Plan — TD-189 Backlog hygiene upgrades (2026-05-18)

## FINAL DISPOSITION 2026-05-20 — Track A DROPPED, Track B SHIPPED, sweep re-seeded as TD-215

Wave-execution analysis of the real `BACKLOG.md` (main `956aed1`, 1430 lines) overturned the sharding migration:
- The "two-format parser + manifest" gate is provably insufficient — §6 has **9 bullet-list rows** (`- **UX-08/09/11/12/13/22/23/24**`) the parser drops silently while the manifest stays green; §4's table schema is self-inconsistent (3-col header, 4-col rows). Real structure = multi-schema tables + heading-blocks + bullet-lists + organizational `###` headers.
- Narrowing to §1-only exposed the deeper truth: of **251 §1 table rows, 198 (79%) are `✅ Shipped` cruft** never swept to §7. Sharding would spread 198 inert rows across 198 files for ~zero collision benefit — the active/collision-prone set is only ~53 rows.
- **Operator decision (2026-05-20):** drop Track A sharding entirely; ship Track B; re-seed the real win — a §7 hygiene sweep — as **TD-215** (P2). The sweep shrinks the §1 collision surface ~5× more cheaply than per-row sharding ever would.

**SHIPPED (Track B, this session):**
- `BACKLOG.md §11` — row template amendment (Surface / Assertion / Risk / Size / Verification command), forward-only, existing rows grandfathered.
- `BACKLOG.md §1` — new row **TD-215** (sweep shipped rows → §7), dogfooding the §11 template.
- `~/.claude/skills/verify-row/SKILL.md` — new skill; reads rows from monolithic `BACKLOG.md` by ID (no shards), warn-only verdicts.
- `~/.claude/skills/sprint/SKILL.md` + `references/step-3a-verify-row.md` — Step 3a integration (fire `/verify-row` after Gate 1, before Step 3b).

Track A material below (sharding parser, manifest, 297-shard baseline) is **superseded** — retained for history only.

---


**Sprint slug:** `td-189-backlog-hygiene-upgrades`
**Status:** 🚩 ASAP — pick first on next /sprint
**Risk:** MEDIUM (touches BACKLOG-as-SoT contract; sharding migration is high blast-radius)
**Size:** M (~half-day; 2-track wave viable)

---

## Re-baseline 2026-05-20T05:04Z (SUPERSEDES counts below) — deferred to a dedicated fresh session

Main advanced to `9732cf24` (PRs #664 e2e-flake-fix, #665 audit-rows TD-202..214 merged after the refresh below). **Authoritative migration baseline now: 284 table rows + 13 §5 heading-block rows = 297 shards.** The "271 rows / 1410 lines" figures in the Refresh-1 section and Track A acceptance below are STALE — the fresh session must re-measure (`grep -cE '^\| [A-Z]+-[0-9]' BACKLOG.md` for table rows, `grep -cE '^### [A-Z]+-[0-9]+ — ' BACKLOG.md` for §5 blocks) and the `.manifest.sha256` must cover ALL 297. Operator deferred Track A execution to its own fresh session (2026-05-20) because the mapped scope (297-shard two-format parser + `backlog-sync` skill rewrite + ADR + CI guard) is materially larger/higher-blast-radius than the gated "M". Gate 1 + Gate 2 approvals + the two-format-parser finding + Gate-2 decisions all still hold; only the row-count baseline changed. Resume: `/sprint --session s1 --resume`.

---

## Refresh 2026-05-20 (re-validated against main `472ee48`, +31 commits from authoring base `afb8086`)

Cold-start probe before re-gating found two drift surfaces, corrected below:

- **Track A scope grew.** `BACKLOG.md` is now **1410 lines / 271 matched rows** (was smaller at authoring). Repo-wide `BACKLOG.md` references = **40 files** (excluding `node_modules`/`.git`/plan-docs), but the overwhelming majority are **prose mentions** ("BACKLOG.md is the SoT") that stay valid because `BACKLOG.md` remains the index after sharding. The only **programmatic reader** is `~/.claude/skills/backlog-sync/SKILL.md` (89 lines; reads `BACKLOG.md` monolithically at its line 31). So Track A's "update all references" sweep splits into: (a) 1 programmatic reader to rewrite (backlog-sync skill) + ADR-0002 amendment; (b) ~40 prose references to spot-check, most needing zero change.
- **Track B target restructured.** The sprint skill is now `Step 3 (Gate 1) → Step 3b (OWASP) → Step 3c (anchor) → Step 4 (implementation-plan)`, split into `SKILL.md` + a `references/` dir, with multi-session + track-executor modes added. The plan's original "Step 3 → 3a-verify → 3b" patch text **no longer exists verbatim**. `/verify-row` slots as **Step 3a — immediately after Step 3 (Gate 1 approval), before Step 3b**. Critical: verify-row's verdict is *planning input* (`/implementation-plan` is Step 4), so the integration MUST thread the verdict forward — a `stale: <diff>` result is written to SPRINT_STATE.md `## Row verification` and Step 4's brief consumes it; a `wrong` result blocks at Gate 1 until the row is re-scoped — and re-scoping a row re-triggers **Step 3c (anchor check)** as well as Step 4, since a re-scoped row can introduce/remove load-bearing concepts. Firing it before 3b without threading would leave Steps 3c + 4 planning against unverified rows (the exact gap this skill targets). The resumption table in `references/resumption.md` gains a `verify-row` row.

- **Concurrency: Track A is NOT atomic across the repo/harness boundary** (repo `BACKLOG.md` rewrite + orchestrator-side `~/.claude/skills/backlog-sync/SKILL.md` rewrite). A `/backlog-sync` run by any other session in the window between A's merge and the skill-edit landing would parse the new index with the old monolithic line-31 reader and corrupt §0/§7. **Correction (cycle 2): there is NO existing `BACKLOG_MIGRATION` lock — `claims.json` is a flat per-row claim map with no lock primitive, and `backlog-sync/SKILL.md:87` forbids backlog-sync from touching `claims.json` at all. Do not invent a lock and silently contradict that rule.** The honest mitigation is **ordering + operational serialization**, not a fabricated lock:
  1. **Skill-rewrite-first ordering (hard rule):** land the `backlog-sync` SKILL.md shard-aware rewrite *before or in the same lockstep step as* the `BACKLOG.md` index rewrite. Never index-first — an index-first window is the only corruption path.
  2. **Single-session migration window:** Track A is migration work; per the repo's multi-session discipline it runs with no concurrent `/backlog-sync`. Before starting Track A, confirm `INDEX.md` shows no other active session mid-`sync`/`housekeeping`; the s1 session already holds the TD-189 claim.
  3. **Gate-2 decision (open):** whether to *also* harden this with a real lock primitive is a Track A sub-task to be sized, NOT assumed — it would require (a) defining a lock schema and (b) amending `backlog-sync/SKILL.md:87` to let the skill read (not sweep) it. Recommend deferring the hardened lock to a follow-up row unless Gate 2 wants it in-scope; ordering + single-session window is sufficient for the bootstrapped single-operator reality.

- **ADR-0002 enforcement surface shifts (does NOT auto-improve).** Sharding eliminates *adjacent-row table* merge conflicts (real win) but ADR-0002 rule 1 ("feature PRs must not touch the backlog AT ALL") gets *harder* to eyeball: 271 loose files hide an accidental `backlog/**` touch better than one monolith does. The amendment must add an enforcement compensator — a CI guard rejecting `backlog/**` + `BACKLOG.md` edits in non-`chore(backlog):` PRs. Gate-2 Q1 should pre-answer the SoT definition (index + shards together) rather than defer it.

---

## Motivation (the data)

Across the 4 sprints this session (TD-87, td-170de-pair, td-181-180, td-186-183, td-188-179), `/opus-on-opus` **cycle 1** has surfaced 2–3 must-fix items per sprint. Cataloguing them by root cause:

| Sprint | Cycle-1 must-fix # | Root cause |
|---|---|---|
| td-181-180 | 3 | Backlog row TD-181 claimed `Sentry.captureException`/`addBreadcrumb` uncovered — already covered. Hook signature wrong for tRPC config-time API. Sentinel removal premature. |
| td-186-183 | 2 | Backlog row TD-183 claimed `weeklyDigest` consumes `getWeekStamp` — dead code, no consumers. Raw `err.message` pass-through would leak Postgres constraint names. |
| td-188-179 | 2 | `flushSync` removal flipped a documented LOCKED contract one sprint after locking. SQLSTATE `P0003` collision with `too_many_rows`. |

**Pattern:** ~50% of must-fix items trace to **vague or stale backlog row descriptions**. Rows written days/weeks before pickup go stale against the live codebase, and the planning agent re-discovers truth at /opus-on-opus cycle 1 — burning 1–2 cycles per sprint. The other ~50% are genuinely good adversarial catches (regex collisions, contract semantics). The first class is what TD-189 targets.

---

## Three coordinated upgrades

### Upgrade A — Row template (BACKLOG.md §11 amendment)

Amend the "Agent contract" section so every new row MUST include:

```
**Surface (verified <date>):**
- file:line — `<exact symbol or anchor>` — current state at row-write time
**Assertion of current state:**
- One sentence stating what is true in the code TODAY that motivates this row
**Risk:** LOW | MEDIUM | HIGH
**Size:** XS (<30min) | S (~1h) | M (~half-day) | L (multi-day)
**Verification command (one-shot):**
\`\`\`sh
# command that confirms or refutes the row's current relevance
\`\`\`
```

Existing rows grandfathered (retrofitting all 271 rows across §1–§6 — of which ~38 are §1 Ready — is not worth the sprint cost). The contract enforces forward only.

### Upgrade B — Sharded backlog

Migrate per-row content into `backlog/<id>.md` (one file per row, frontmatter + body). `BACKLOG.md` becomes the at-a-glance index:

```markdown
| TD-188 | 🟢 Ready · P3 / Low | [backlog/td-188.md](backlog/td-188.md) | TD-186 /oop residuals — formatMutationError over-strip + flushSync removal + ESLint TemplateLiteral |
```

**Eliminates the parallel-PR rebase pattern** documented in `.claude/CLAUDE.md ## Parallel-dispatch BACKLOG.md conflicts`. Today 90% of multi-PR merge pain is BACKLOG.md adjacent-row collisions; sharding makes per-row edits hit per-file diffs that never collide.

ADR-0002 amendment required: clarify that the "single source of truth" property is satisfied by `BACKLOG.md` + `backlog/` together; index and shards are atomically updated.

### Upgrade C — `/verify-row` pre-flight skill

New skill that runs between `/sprint` Step 3 (Gate 1 approval) and Step 3b (OWASP):

```
/verify-row <id> [<id>...]
```

For each row:
1. Read the shard at `backlog/<id>.md`.
2. Re-grep every file path / symbol claim against current source.
3. Re-run the row's "verification command" if specified.
4. Diff claims-as-written vs facts-as-observed.

Output one of:
- **`current`** — claims match source; proceed.
- **`stale: <diff>`** — paths exist but line numbers / symbol bodies drifted; surface diff, planner adjusts.
- **`wrong: <evidence>`** — fundamental claim contradicted (e.g., row says "X is uncovered" but grep shows X covered); BLOCK at Gate 1 until user re-scopes the row.

`/sprint` skill change: between Step 3 and Step 3b, fire `/verify-row` on each row in the chunk. `wrong` blocks; `stale` surfaces for ack.

---

## Tracks

| Track | Branch | Owned files | Acceptance |
|---|---|---|---|
| A — Sharding migration | `chore/td-189a-backlog-shard` | `BACKLOG.md` (rewrite to index form), new `backlog/<id>.md` files (one per row in §1–§6 — **271 rows** as of `472ee48`), `~/.claude/skills/backlog-sync/SKILL.md` (rewrite the line-31 monolithic read AND the §3a/§3 stale-detector path-extraction regexes to glob `backlog/*.md`; preserve §0 board counts + §7 shipped-log behavior. **Per-step file mapping (must be explicit in the rewrite):** §0 board counts + §7 shipped-log read/write the **index** `BACKLOG.md`; the per-row stale/path detectors (§3a, §3) read **shards** `backlog/*.md`; row promotion to §7 updates both the shard's status field and the index row), ADR-0002 amendment | **Content preservation (not just count):** before migration, generate `backlog/.manifest.sha256` mapping each `<id>` → sha256 of its normalized row body extracted from BACKLOG.md; after migration, re-extract each shard's body, normalize identically, and assert every checksum matches (script exits non-zero on any mismatch or missing id). Row-count parity (`grep -c '^| [A-Z]\+-[0-9]'` on index == 271) is necessary but NOT sufficient — the checksum manifest is the real gate. `/backlog-sync` still rebuilds §0 + §7 against shards; ADR-0002 amended; the ~40 prose references spot-checked (most unchanged — index path stable); CI green |
| B — Row template + /verify-row skill | `feat/td-189b-row-template-and-verify` | `BACKLOG.md §11` amendment (row schema), new `~/.claude/skills/verify-row/SKILL.md`, `~/.claude/skills/sprint/SKILL.md` + `references/` integration patch (insert a `/verify-row` fire **between Step 3/Gate 1 and Step 3b/OWASP**; the resumption table in `references/resumption.md` may need a row), 2-3 test fixtures (one current row, one stale row, one wrong row) | New row schema documented in §11; `/verify-row TD-184` produces correct verdict against current main; `/sprint` invokes `/verify-row` after Gate 1, before Step 3b |

**File-disjoint (mostly):** Track A rewrites BACKLOG.md to index form (massive churn); Track B touches `BACKLOG.md §11` (a single section). Sequence: **A merges first, then B rebases.** Not parallel-eligible — must serialize. **Note:** Track A edits a user-level harness file (`~/.claude/skills/backlog-sync/SKILL.md`) outside the repo — not capturable in the repo PR diff; land it as an orchestrator-side edit alongside the repo PR, gated by the `BACKLOG_MIGRATION` lock (see Refresh §Concurrency).

## Mode

Sequential `/wave`, NOT parallel. Track A merges → main updates → Track B rebases off new BACKLOG.md and lands its §11 amendment.

## Risks

- **Sharding migration is high blast-radius.** Measured 2026-05-20: **40** non-vendored files reference `BACKLOG.md`, but only **1** parses it programmatically (`backlog-sync` SKILL.md); the rest are prose mentions that survive because the index path is unchanged. Mitigation: rewrite the 1 parser + ADR-0002 in the same PR; spot-check the 40 prose refs (expect ~0 edits).
- **TWO row formats (verified 2026-05-20 — load-bearing for the migration script).** §1–§4 use single-line pipe table rows (`| <ID> | Status | Owner | Branch/PR | Story | Notes |`); **§5 "Large features" uses heading-block rows** (`### <ID> — title · ~Nd` with multi-paragraph prose until the next `###`), NOT table rows. A sharding parser that only splits table rows would **silently drop every §5 row** and the manifest checksum gate would still pass if it only checksums table rows — so the manifest MUST enumerate IDs from BOTH formats. The migration script handles: (a) table-row extraction keyed on leading `| <ID> |`; (b) §5 heading-block extraction (body = heading + prose until next `###`). The 271-row count and `.manifest.sha256` MUST cover both.
- **`/backlog-sync` skill rewrite** must preserve current behavior for §0 board counts + §7 shipped log. Test against a real sprint close before flipping.
- **ADR-0002 amendment** is the social contract change — operator and harness must agree on the new SoT definition. Get explicit ack at Gate 2.
- **`/verify-row` accuracy** — false-positives ("row says X exists, grep can't find it") will burn cycles. Start permissive (warn-only) until calibrated.

## Out of scope

- Retrofitting the row template onto existing rows (grandfathered).
- Multi-session driver pattern (separate concern; revisit after this lands).
- Backlog UI / dashboard (CLI-driven harness, not building a webapp).

## Pre-Gate-1 verification command

```sh
# Confirm the sharding migration won't lose content:
wc -l BACKLOG.md                       # 1410 as of 472ee48 (2026-05-20)
grep -c "^| [A-Z]\+-[0-9]" BACKLOG.md  # 271 rows as of 472ee48
```

Run before /sprint pickup so Track A's "no content loss" acceptance is measurable. **Baseline locked 2026-05-20: 1410 lines / 271 rows.** Post-migration assertion: total rows across `backlog/<id>.md` shards == 271.

## Gate-2 decisions (RESOLVED 2026-05-20 — binding on executors)

1. **SoT definition:** ADR-0002 amended so SoT = `BACKLOG.md` **index + `backlog/<id>.md` shards together**, atomically updated. Track A drafts this amendment text in-PR.
2. **Concurrency enforcement:** **ordering (skill-rewrite-first, never index-first) + single-session migration window.** A hardened lock primitive is OUT of scope for this sprint — if wanted later, seed a follow-up row (do NOT expand Track A or touch `claims.json`/`backlog-sync` rule line 87).
3. **/verify-row strictness:** **warn-only first.** Surface `stale`/`wrong` verdicts for operator ack at Gate 1; do NOT hard-block until accuracy is calibrated. (Revisit hard-block as a follow-up once false-positive rate is known.)
4. **Row retrofit:** existing 271 rows grandfathered; new rows conform forward only (unchanged from plan body).
