"use client";

import { createContext, useState } from "react";

export type Destination =
  | "journal"
  | "medications"
  | "team"
  | "shifts"
  | "documents"
  | "more";

type SidebarContextType = {
  activeDestination: Destination;
  setActiveDestination: (dest: Destination) => void;
};

export const SidebarContext = createContext<SidebarContextType>({
  activeDestination: "journal",
  setActiveDestination: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [activeDestination, setActiveDestination] =
    useState<Destination>("journal");
  return (
    <SidebarContext.Provider
      value={{ activeDestination, setActiveDestination }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
