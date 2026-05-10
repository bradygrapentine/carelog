# Architecture Decision Records

This directory captures load-bearing architectural decisions for Carelog. Each ADR records a single decision with its context, the choice made, and the consequences accepted.

New ADRs are written via the global `write-adr` skill or by hand. Sequence: `NNNN-kebab-case-slug.md` (zero-padded, monotonically increasing). Status is `Accepted` for codified rules; use `Proposed` / `Superseded` only when a decision is genuinely in flux.

## Index

- [0001 — PHI must use anonymous UUID only in analytics](./0001-phi-anonymous-uuid-only.md)
- [0002 — BACKLOG.md is the single source of truth for planned work](./0002-backlog-as-single-source-of-truth.md)
