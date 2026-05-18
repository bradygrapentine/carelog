# Architecture Decision Records

> **Canonical surface for architecture and system-design decisions** (audience: engineers reading code). Product language, tone, and UX decisions belong in [`docs/project-info/product/UX_DECISIONS.md`](../project-info/product/UX_DECISIONS.md).

This directory captures load-bearing architectural decisions for Carelog. Each ADR records a single decision with its context, the choice made, and the consequences accepted.

New ADRs are written via the global `write-adr` skill or by hand. Sequence: `NNNN-kebab-case-slug.md` (zero-padded, monotonically increasing). Status is `Accepted` for codified rules; use `Proposed` / `Superseded` only when a decision is genuinely in flux.

## Index

- [0001 — PHI must use anonymous UUID only in analytics](./0001-phi-anonymous-uuid-only.md)
- [0002 — BACKLOG.md is the single source of truth for planned work](./0002-backlog-as-single-source-of-truth.md)
- [0003 — `needs-phi-review` label removal protocol](./0003-phi-review-label-protocol.md)
- [0004 — Feature flag rollout pattern (PostHog, PHI-safe distinctId)](./0004-feature-flag-rollout-pattern.md)
- [0005 — Lighthouse a11y CI gate: build locally and audit in CI (path b)](./0005-lighthouse-a11y-gate-path.md)
