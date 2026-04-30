"use client";

import { useEffect, useState } from "react";

/**
 * A11Y-019 — global SR-only live region.
 *
 * Mounts a single `aria-live="polite"` region that screen readers
 * announce when its text content changes. App code calls `liveAnnounce()`
 * to push a message; the region clears the message after 5 s so a
 * repeated identical announcement still fires.
 *
 * Designed for: offline-queue transitions ("logged offline", "synced"),
 * optimistic-update rollbacks ("could not save — try again"), and other
 * background state changes the visual UI doesn't already surface to
 * keyboard / screen-reader users.
 *
 * Mount once near the app shell root. Calling `liveAnnounce("…")` from
 * anywhere triggers a re-render of the region.
 */

type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export function liveAnnounce(message: string): void {
  for (const fn of listeners) fn(message);
}

export function LiveRegion() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fn: Listener = (msg) => setMessage(msg);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  // Clear after 5s so a repeat-of-same-message still announces.
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(id);
  }, [message]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="live-region"
      className="sr-only"
    >
      {message}
    </div>
  );
}
