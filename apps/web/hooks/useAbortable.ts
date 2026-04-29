"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseAbortableReturn = {
  signal: AbortSignal;
  abort: () => void;
  reset: () => void;
  isAborted: boolean;
};

/**
 * Provides an AbortController whose signal is automatically aborted on component
 * unmount. Call `reset()` to get a fresh non-aborted signal (e.g. before a
 * re-fetch triggered by a prop change).
 */
export function useAbortable(): UseAbortableReturn {
  const controllerRef = useRef<AbortController>(new AbortController());
  const [, forceUpdate] = useState(0);

  // Abort on unmount
  useEffect(() => {
    return () => {
      controllerRef.current.abort();
    };
  }, []);

  const abort = useCallback(() => {
    controllerRef.current.abort();
    forceUpdate((n) => n + 1);
  }, []);

  const reset = useCallback(() => {
    // Abort any in-flight request on the old controller first
    controllerRef.current.abort();
    controllerRef.current = new AbortController();
    forceUpdate((n) => n + 1);
  }, []);

  return {
    signal: controllerRef.current.signal,
    abort,
    reset,
    isAborted: controllerRef.current.signal.aborted,
  };
}
