export function pickJournalBody(
  payload: Record<string, unknown> | null,
): string | null {
  if (!payload) return null;
  const text = payload.text;
  if (typeof text === "string" && text.length > 0) return text;
  const note = payload.note;
  if (typeof note === "string" && note.length > 0) return note;
  const notes = payload.notes;
  if (typeof notes === "string" && notes.length > 0) return notes;
  return null;
}
