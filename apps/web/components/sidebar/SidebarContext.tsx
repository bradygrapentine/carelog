"use client";

import { createContext, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type Destination =
  | "journal"
  | "medications"
  | "team"
  | "shifts"
  | "documents"
  | "messages"
  | "more";

const VALID: readonly Destination[] = [
  "journal",
  "medications",
  "team",
  "shifts",
  "documents",
  "messages",
  "more",
];

type SidebarContextType = {
  activeDestination: Destination;
  setActiveDestination: (dest: Destination) => void;
};

export const SidebarContext = createContext<SidebarContextType>({
  activeDestination: "journal",
  setActiveDestination: () => {},
});

// The URL's `?panel=` query param is the single source of truth. Both the
// top-bar tabs (AppTabBar) and the sidebar nav go through this context, so
// clicks stay in sync with the URL and a page reload on `?panel=medications`
// renders the correct panel immediately.
export function SidebarProvider({
  children,
  defaultDestination,
}: {
  children: React.ReactNode;
  defaultDestination?: Destination;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const panelParam = searchParams?.get("panel") ?? null;
  const activeDestination: Destination = (VALID as readonly string[]).includes(
    panelParam ?? "",
  )
    ? (panelParam as Destination)
    : (defaultDestination ?? "journal");

  const setActiveDestination = useCallback(
    (dest: Destination) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("panel", dest);
      router.replace((pathname ?? "") + "?" + params.toString(), {
        scroll: false,
      });
    },
    [router, pathname, searchParams],
  );

  return (
    <SidebarContext.Provider
      value={{ activeDestination, setActiveDestination }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
