"use client";

type Props = { onClick: () => void; isOpen: boolean };

export function AIFab({ onClick, isOpen }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
      aria-expanded={isOpen}
      className={`fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 ${
        isOpen
          ? "bg-[var(--color-ink)] text-white scale-95"
          : "bg-[var(--color-primary)] text-white hover:scale-105 active:scale-95"
      }`}
    >
      {isOpen ? "✕" : "✦"}
    </button>
  );
}
