import type { NameMap } from "./ai-deidentify";

export type PageContext =
  | "dashboard"
  | "medications"
  | "schedule"
  | "journal"
  | "messages"
  | "team"
  | "education"
  | "other";

export type ContextData = {
  recentMoodScores: string[];
  activeMedCount: number;
  unreadMessageCount: number;
  upcomingShiftCount?: number;
  missedDosesThisWeek?: number;
  recentJournalCount?: number;
  nameMap: NameMap;
};

/**
 * Format a de-identified context blob to inject into the Claude API prompt.
 * NEVER include free-text fields (journal bodies, message text, document content).
 */
export function formatContextBlob(
  pageContext: PageContext,
  data: ContextData,
): string {
  const recipientToken =
    data.nameMap.values().next().value ?? "the care recipient";

  const lines: string[] = [
    `Current view: ${pageContext}`,
    `Care recipient: ${recipientToken}`,
  ];

  if (data.recentMoodScores.length > 0) {
    lines.push(
      `Recent mood scores (last 48h): ${data.recentMoodScores.join(", ")}`,
    );
  }

  if (pageContext === "medications" || pageContext === "dashboard") {
    lines.push(`Active medications: ${data.activeMedCount}`);
    if (data.missedDosesThisWeek !== undefined) {
      lines.push(`Missed doses this week: ${data.missedDosesThisWeek}`);
    }
  }

  if (pageContext === "messages" || pageContext === "dashboard") {
    lines.push(`Unread messages: ${data.unreadMessageCount}`);
  }

  if (
    (pageContext === "schedule" || pageContext === "dashboard") &&
    data.upcomingShiftCount !== undefined
  ) {
    lines.push(`Upcoming shifts this week: ${data.upcomingShiftCount}`);
  }

  if (pageContext === "journal" && data.recentJournalCount !== undefined) {
    lines.push(`Journal entries this week: ${data.recentJournalCount}`);
  }

  return lines.join("\n");
}
