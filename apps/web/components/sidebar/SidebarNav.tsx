"use client";

import { useContext } from "react";
import { SidebarContext } from "./SidebarContext";
import type { Destination } from "./SidebarContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

const NAV_ITEMS: { dest: Destination; label: string; icon: string }[] = [
  { dest: "journal", label: "Journal", icon: "📋" },
  { dest: "medications", label: "Medications", icon: "💊" },
  { dest: "team", label: "Team", icon: "👥" },
  { dest: "shifts", label: "Shifts", icon: "📅" },
  { dest: "documents", label: "Documents", icon: "📁" },
  { dest: "messages", label: "Messages", icon: "💬" },
  { dest: "more", label: "More", icon: "⋯" },
];

type Props = {
  showLabels?: boolean;
  onNavigate?: () => void;
};

export function SidebarNav({ showLabels = false, onNavigate }: Props) {
  const { activeDestination, setActiveDestination } =
    useContext(SidebarContext);

  function handleClick(dest: Destination) {
    setActiveDestination(dest);
    onNavigate?.();
  }

  return (
    <TooltipProvider>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ dest, label, icon }) => {
          const isActive = activeDestination === dest;
          const buttonEl = (
            <button
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => handleClick(dest)}
              className={[
                "flex items-center gap-3 rounded-lg transition-[border-color,background-color] motion-safe:duration-150",
                showLabels
                  ? "px-3 py-2 w-full text-left"
                  : "w-10 h-10 justify-center mx-auto",
                isActive
                  ? "bg-[rgba(167,139,250,0.2)] border border-[rgba(59,130,246,0.4)] text-white border-l-2 border-l-[var(--color-primary)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[rgba(255,255,255,0.07)]",
              ].join(" ")}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {icon}
              </span>
              {showLabels && (
                <span className="text-sm font-medium">{label}</span>
              )}
            </button>
          );

          if (showLabels) {
            return <div key={dest}>{buttonEl}</div>;
          }

          return (
            <Tooltip key={dest}>
              <TooltipTrigger asChild>{buttonEl}</TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
