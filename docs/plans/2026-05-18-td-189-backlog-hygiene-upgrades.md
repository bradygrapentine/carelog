# Plan — TD-189 Backlog hygiene upgrades (2026-05-18)

**Sprint slug:** `td-189-backlog-hygiene-upgrades`
**Status:** 🚩 ASAP — pick first on next /sprint
**Risk:** MEDIUM (touches BACKLOG-as-SoT contract; sharding migration is high blast-radius)
**Size:** M (~half-day; 2-track wave viable)

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

Existing rows grandfathered (sprint cost to retrofit all 38 §1 rows is not worth it). The contract enforces forward.

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
| A — Sharding migration | `chore/td-189a-backlog-shard` | `BACKLOG.md` (rewrite to index form), new `backlog/<id>.md` files (one per row in §1–§6), `~/.claude/skills/backlog-sync/` skill update to read/write shards, ADR-0002 amendment | All existing rows migrate without content loss; `/backlog-sync` still works; ADR-0002 amended; CI green |
| B — Row template + /verify-row skill | `feat/td-189b-row-template-and-verify` | `BACKLOG.md §11` amendment (row schema), new `~/.claude/skills/verify-row/SKILL.md`, `~/.claude/skills/sprint/SKILL.md` integration patch (Step 3 → 3a-verify → 3b), 2-3 test fixtures (one current row, one stale row, one wrong row) | New row schema documented in §11; `/verify-row TD-184` produces correct verdict against current main; `/sprint` invokes `/verify-row` after Gate 1 |

**File-disjoint (mostly):** Track A rewrites BACKLOG.md to index form (massive churn); Track B touches `BACKLOG.md §11` (a single section). Sequence: **A merges first, then B rebases.** Not parallel-eligible — must serialize.

## Mode

Sequential `/wave`, NOT parallel. Track A merges → main updates → Track B rebases off new BACKLOG.md and lands its §11 amendment.

## Risks

- **Sharding migration is high blast-radius.** Every backlog reference in skills, docs, and CLAUDE.md files may need updates. Mitigation: grep `BACKLOG\.md` repo-wide before migration; update all references in the same PR.
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
wc -l BACKLOG.md
grep -c "^| [A-Z]\+-[0-9]" BACKLOG.md  # row count
```

Run before /sprint pickup so Track A's "no content loss" acceptance is measurable.

## Gate-2 must answer

1. Is the sharded backlog still considered "single source of truth" per ADR-0002, or do we amend the ADR to define SoT as `BACKLOG.md` index + `backlog/<id>.md` shards together?
2. Should `/verify-row` block at Gate 1 (hard stop on `wrong`) or only warn (operator decides)?
3. After landing, do we retrofit existing rows opportunistically (when touched) or never?
