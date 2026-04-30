"use client";

import { useEffect, useState } from "react";

/**
 * TD-103 — debounce a fast-changing value (typically a search-input string).
 *
 * On each `value` change, schedules a timer for `delayMs` and returns the
 * previous debounced value until the timer fires. Cancels on unmount or on
 * the next change.
 *
 * Use for: search/filter inputs that drive `useMemo` filtering over
 * 100–10,000 items, where keystroke-rate re-rendering causes stutter on
 * cheaper devices.
 *
 * @example
 *   const [query, setQuery] = useState("")
 *   const debounced = useDebouncedValue(query, 200)
 *   const filtered = useMemo(() => rows.filter(r => r.includes(debounced)), [rows, debounced])
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
