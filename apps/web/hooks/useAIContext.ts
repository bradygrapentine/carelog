"use client";

import { usePathname } from "next/navigation";

export type Suggestion = { label: string; prompt: string };

const CONTEXT_SUGGESTIONS: Record<string, Suggestion[]> = {
  dashboard: [
    {
      label: "📋 Summarize last 48h",
      prompt:
        "Summarize all care updates and mood entries from the last 48 hours.",
    },
    {
      label: "⚠️ Flag anything urgent",
      prompt: "Are there any urgent items I should know about?",
    },
  ],
  medications: [
    {
      label: "💊 Check today's adherence",
      prompt: "How is medication adherence looking today?",
    },
    {
      label: "⚠️ Flag missed doses",
      prompt: "Were there any missed doses in the last 7 days?",
    },
  ],
  schedule: [
    {
      label: "📅 Cover next week",
      prompt: "Review next week's schedule and suggest how to fill any gaps.",
    },
    {
      label: "🔍 Unassigned slots",
      prompt: "Which shifts are currently unassigned?",
    },
  ],
  journal: [
    {
      label: "📈 Mood trends",
      prompt: "What mood trends are showing this month?",
    },
    {
      label: "📝 Summarize entries",
      prompt: "Summarize the last 10 journal entries.",
    },
  ],
  messages: [
    {
      label: "✉️ Draft team message",
      prompt: "Help me draft a message to the team.",
    },
    { label: "📬 Unread summary", prompt: "Summarize any unread messages." },
  ],
  team: [
    {
      label: "👥 Who's available?",
      prompt: "Who on the team is available this week?",
    },
  ],
};

const GLOBAL_SUGGESTIONS: Suggestion[] = [
  {
    label: "📋 Summarize last 48h",
    prompt: "Summarize all updates from the last 48 hours.",
  },
  {
    label: "✉️ Draft team message",
    prompt: "Help me draft a message to the team.",
  },
];

export function useAIContext() {
  const pathname = usePathname();

  let pageKey = "other";
  if (pathname.includes("/dashboard")) pageKey = "dashboard";
  else if (pathname.includes("/medications")) pageKey = "medications";
  else if (pathname.includes("/shifts") || pathname.includes("/schedule"))
    pageKey = "schedule";
  else if (pathname.includes("/journal")) pageKey = "journal";
  else if (pathname.includes("/messages")) pageKey = "messages";
  else if (pathname.includes("/team")) pageKey = "team";
  else if (pathname.includes("/education")) pageKey = "education";

  const contextSuggestions = CONTEXT_SUGGESTIONS[pageKey] ?? [];
  const globalSuggestions = GLOBAL_SUGGESTIONS.filter(
    (g) => !contextSuggestions.some((c) => c.prompt === g.prompt),
  );

  return { pageKey, suggestions: contextSuggestions, globalSuggestions };
}
