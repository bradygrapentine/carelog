"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";

type Theme = "system" | "light" | "dark";

const OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "system", icon: Monitor, label: "System" },
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="flex gap-1 rounded-lg border border-[var(--color-border)] p-1"
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <Button
          key={value}
          variant={theme === value ? "default" : "ghost"}
          size="sm"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          className="flex-1 gap-2"
        >
          <Icon size={16} aria-hidden="true" />
          {label}
        </Button>
      ))}
    </div>
  );
}
