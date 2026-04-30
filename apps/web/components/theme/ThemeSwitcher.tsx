"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Palette } from "lucide-react";

export type Palette = "hearth" | "sage";

const PALETTE_STORAGE_KEY = "carelog-palette";
const THEME_STORAGE_KEY = "carelog-theme";

export function applyPalette(palette: Palette) {
  if (palette === "hearth") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", palette);
  }
}

function readPalette(): Palette {
  try {
    const v = localStorage.getItem(PALETTE_STORAGE_KEY);
    return v === "sage" ? "sage" : "hearth";
  } catch {
    return "hearth";
  }
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
  const [palette, setPalette] = useState<Palette>("hearth");
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPalette(readPalette());
    setIsDark(readDark());
    setMounted(true);
  }, []);

  function setPaletteAndPersist(next: Palette) {
    setPalette(next);
    applyPalette(next);
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable; runtime change still applies.
    }
  }

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

  // Render a stable skeleton on the server to avoid hydration mismatch.
  // Real values land after mount via the effect above.
  const showDark = mounted ? isDark : false;
  const showPalette = mounted ? palette : "hearth";

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1 ${className ?? ""}`}
      role="group"
      aria-label="Theme"
    >
      <button
        type="button"
        onClick={() => setPaletteAndPersist("hearth")}
        aria-pressed={showPalette === "hearth"}
        aria-label="Hearth palette (violet)"
        title="Hearth — violet & plum"
        className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] ${
          showPalette === "hearth"
            ? "bg-[var(--color-primary)] text-[var(--color-app-shell-text)]"
            : "text-[var(--color-muted)] hover:bg-[var(--color-primary-subtle)]"
        }`}
      >
        <Palette className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">Hearth</span>
      </button>
      <button
        type="button"
        onClick={() => setPaletteAndPersist("sage")}
        aria-pressed={showPalette === "sage"}
        aria-label="Sage parlor palette"
        title="Sage parlor — eucalyptus & putty"
        className={`flex h-7 items-center justify-center rounded-full px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] ${
          showPalette === "sage"
            ? "bg-[#5a7a5a] text-white"
            : "text-[var(--color-muted)] hover:bg-[var(--color-primary-subtle)]"
        }`}
      >
        Sage
      </button>
      <span
        aria-hidden="true"
        className="mx-0.5 h-4 w-px bg-[var(--color-border)]"
      />
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
