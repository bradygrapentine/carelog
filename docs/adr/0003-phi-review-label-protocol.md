# ADR 0003: `needs-phi-review` label removal protocol

**Status:** Accepted
**Date:** 2026-05-10
**Deciders:** Brady Grapentine

## Context

GitHub branch protection on `carelog` requires the `needs-phi-review` label to be cleared before a PR can auto-merge. The label is auto-applied by a workflow whenever a diff touches files matching analytics imports, identity-vault reads, or PHI-class migrations — codifying ADR-0001 (PHI must use anonymous UUID only).

In the 2026-05-10 PM session, PR #453 (recipient profile data wiring) sat blocked for ~25 minutes. The CI status looked clean and the orchestrator initially misdiagnosed the blocker as a Vercel preview-deploy failure; the actual cause was the unfinished `needs-phi-review` review. Once identified, an admin merge bypass shipped the PR without a reviewer comment recording that the diff had been audited.

Two failure modes recurred enough to need a written protocol:

1. **Misdiagnosis** — agents see auto-merge stalled and assume CI failure or branch protection rules other than the label.
2. **Silent self-clear** — when an orchestrator removes the label without leaving a review comment, there's no audit trail explaining why the PHI scrutiny was deemed unnecessary.

## Decision

The `needs-phi-review` label is removed only after one of two paths completes:

### Path A — human review (default)

A human teammate (or Brady, on solo work) reads the diff, confirms PHI rules hold, leaves a review comment on the PR with the form:

> PHI review: clean — `<one-line scope statement>`

Then removes the label via `gh pr edit <num> --remove-label needs-phi-review`.

### Path B — orchestrator self-clear (narrow exception)

An orchestrator may self-clear the label IFF **all** of the following are true:

1. The diff touches **none** of:
   - Analytics SDK imports (`posthog`, `segment`, `amplitude`, `Sentry.setUser`, `Sentry.setContext`)
   - `identity_vault` reads or writes
   - PHI-class migrations (any migration adding/altering columns on `identity_vault`, `care_recipients.identity_token`, or new tables holding name/email/phone/dob)
2. The orchestrator leaves a review comment with the form:
   > PHI review: self-clear — diff touches none of [analytics SDKs / identity_vault / PHI migrations]. Scope: `<one-line summary>`.
3. The orchestrator runs `gh pr edit <num> --remove-label needs-phi-review`.

If **any** of those three conditions cannot be satisfied, fall back to Path A.

Self-clear is forbidden when any subagent on the wave touched files in the categories above, even if the orchestrator's own diff did not.

## Consequences

**Positive:**

- Misdiagnosis becomes rare: agents will check the label first when auto-merge stalls and the obvious CI checks are green.
- Every label removal carries an auditable PR comment explaining the basis — no silent admin-merge bypasses.
- The narrow self-clear path keeps low-risk PRs (e.g. test-only, doc-only, infra-only) from being held up overnight when no human reviewer is available.

**Negative:**

- Slight overhead per PR — orchestrators must write the one-line scope comment.
- Self-clear scope is intentionally narrow; some borderline PRs (e.g. logging-only changes that arguably don't touch analytics SDKs) will still need Path A. Erring on the side of human review is the intended bias.

**Neutral:**

- No automation change required; this codifies the manual protocol so agents and humans apply it consistently. A future enhancement could lint the PR comment text on label removal, but that is out of scope here.

## References

- ADR-0001 — PHI must use anonymous UUID only in analytics
- 2026-05-10 PM session: PR #453 admin-merge bypass that triggered this ADR
