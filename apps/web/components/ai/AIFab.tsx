"use client";

type Props = { onClick: () => void; isOpen: boolean };

export function AIFab({ onClick, isOpen }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
      aria-expanded={isOpen}
      // (TD-50) right-24 (96px) keeps clear of QuickLogFab's 56px button
      // at right-6 with its 24px gutter. Same z-50 with overlapping bounds
      // caused QuickLogFab (rendered later in the DOM) to intercept clicks
      // meant for this FAB — toBeVisible() passed, .click() timed out.
      className={`fixed bottom-4 right-24 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 ${
        isOpen
          ? "bg-[var(--color-ink)] text-white scale-95"
          : "bg-[var(--color-primary)] text-white hover:scale-105 active:scale-95"
      }`}
    >
      {isOpen ? "✕" : "✦"}
    </button>
  );
}
