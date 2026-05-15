/**
 * Shared journal-event row type — consumed by `useJournalData`,
 * `useJournalActions`, and journal route components.
 *
 * Distinct from `apps/web/lib/careEvent.ts`'s `CareEventRow` discriminated
 * union (which models DB-row variants with typed payloads). This narrower
 * shape is what the journal UI actually iterates over.
 */
export type JournalEvent = {
  id: string;
  event_type: string;
  entry_kind: string;
  occurred_at: string;
  flagged: boolean;
  actor_id: string;
  payload?: { text?: string; mood?: string };
};
