"use client";

import { useCallback, useEffect, useState } from "react";

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
  const [controller, setController] = useState<AbortController>(
    () => new AbortController(),
  );
  const [aborted, setAborted] = useState(false);

  useEffect(() => {
    return () => {
      controller.abort();
    };
  }, [controller]);

  const abort = useCallback(() => {
    controller.abort();
    setAborted(true);
  }, [controller]);

  const reset = useCallback(() => {
    controller.abort();
    setController(new AbortController());
    setAborted(false);
  }, [controller]);

  return {
    signal: controller.signal,
    abort,
    reset,
    isAborted: aborted,
  };
}
