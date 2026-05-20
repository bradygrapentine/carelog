/**
 * API version of the tRPC contract surface.
 *
 * Bump protocol: any change that fails the snapshot-drift assertion in
 * `server/routers/__tests__/schema-snapshot.test.ts` requires either:
 *   1. A bump here (PATCH for additive optional fields, MINOR for additive
 *      required fields with consumer-side defaults, MAJOR for breaking
 *      shape/removal), AND a refreshed `__snapshots__/api-schemas.snap.json`, OR
 *   2. A justification in the PR description explaining why the consumer
 *      surface is unaffected (e.g. internal-only procedure, not yet wired).
 *
 * See `docs/adr/0006-trpc-schema-snapshots.md` for the full convention.
 */
export const API_VERSION = "1.2.0";
