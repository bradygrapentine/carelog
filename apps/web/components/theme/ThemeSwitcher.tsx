"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_STORAGE_KEY = "carelog-theme";

// Kept for backward compatibility — consumers may still import applyPalette.
// Sage is now the only palette; this is a no-op that accepts the old type shape.
export type Palette = "sage";

/** @deprecated Palette switching removed in UX-067. Sage is the only palette. */
export function applyPalette(_palette: Palette) {
  // no-op — Sage is always active
}

function readDark(): boolean {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function ThemeSwitcher({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsDark(readDark());
    setMounted(true);
  }, []);

  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // localStorage unavailable; runtime change still applies.
    }
  }

  const showDark = mounted ? isDark : false;

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1 ${className ?? ""}`}
      role="group"
      aria-label="Theme"
    >
      <button
        type="button"
        onClick={toggleDark}
        aria-label={showDark ? "Switch to light mode" : "Switch to dark mode"}
        aria-pressed={showDark}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-primary-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
      >
        {showDark ? (
          <Sun className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Moon className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
