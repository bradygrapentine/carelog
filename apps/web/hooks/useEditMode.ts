"use client";

// TD-188 contract migration: dropped flushSync (React 19 batches setters in
// event handlers; flushSync was warning-prone when caller is mid-commit).
// onCancel now runs synchronously after setters; callers MUST NOT read
// isEditing inside onCancel. Verified callers (CareTeamList, EmergencyFooterCard)
// only reset local form state in onCancel — no isEditing reads.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Args for `useEditMode`.
 *
 * @property onSuccessRefresh - When true (default), the returned
 *   `handlers.onSuccess` invokes `router.refresh()` after closing edit mode.
 *   Pass `false` to opt out (e.g. when the caller manages its own refresh).
 * @property onCancel - Optional side-effect invoked from `cancel()` AFTER
 *   `isEditing` has flipped to `false` and `error` has been cleared. Use
 *   this to reset caller-owned form fields so the next open() starts clean.
 *   See `cancel()` JSDoc for the ordering contract.
 */
export type UseEditModeArgs = {
  onSuccessRefresh?: boolean;
  onCancel?: () => void;
};

/**
 * Return shape of `useEditMode`.
 *
 * `handlers.onError` accepts a narrowed `{ message: string }` view of a
 * mutation error. tRPC's `TRPCClientErrorLike<AppRouter>` is structurally
 * compatible (it has a `message: string` field), so callers can pass the
 * error straight through without casting.
 */
export type UseEditModeReturn = {
  isEditing: boolean;
  error: string | null;
  open: () => void;
  cancel: () => void;
  /** Compose into `useMutation({ onSuccess, onError })` at the caller site. */
  handlers: {
    onSuccess: () => void;
    onError: (err: { message: string }) => void;
  };
};

/**
 * Tiny state machine for in-panel edit-mode forms with `useMutation` wiring.
 *
 * Owns: `isEditing`, `error`, and the `open`/`cancel` toggles. Returns
 * composable `handlers` (`onSuccess`, `onError`) the caller threads into
 * `useMutation({ onSuccess, onError })` config — preserving caller-specific
 * side effects (toasts, telemetry, form-field resets).
 *
 * Does NOT observe mutation state post-hoc. The mutation lifecycle stays
 * with the caller; this hook only models the open/close/error UI state.
 *
 * ## Cancel contract (TD-188 — flushSync removed)
 *
 * `cancel()` calls `setIsEditing(false)` and `setError(null)` FIRST, then
 * invokes the optional `onCancel` callback. The setters are NOT flushed
 * synchronously — React 19 batches event-handler setters automatically, and
 * `flushSync` was warning-prone when the caller was mid-commit (TD-188).
 *
 * Callers MUST NOT read `isEditing` synchronously inside `onCancel`. The
 * callback exists to reset caller-owned form fields, not to observe hook
 * state. Verified callers (CareTeamList, EmergencyFooterCard) only do
 * setter side-effects on local component state — no isEditing reads.
 *
 * @example
 * const editMode = useEditMode({
 *   onCancel: () => {
 *     setNameInput("");
 *     setPhoneError(null);
 *   },
 * });
 * const mutation = trpc.x.update.useMutation({
 *   onSuccess: () => {
 *     editMode.handlers.onSuccess(); // closes + router.refresh()
 *     showToast("Saved");
 *   },
 *   onError: (err) => editMode.handlers.onError(err),
 * });
 */
export function useEditMode(args?: UseEditModeArgs): UseEditModeReturn {
  const onSuccessRefresh = args?.onSuccessRefresh ?? true;
  const onCancelCallback = args?.onCancel;
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TD-191 item 1: onCancelRef keeps `cancel` referentially stable even when
  // the caller passes an inline arrow for `onCancel`. Inline arrows produce a
  // new function reference every render; before this, `cancel` was rebuilt
  // every render too, defeating any downstream `useMemo`/`useCallback` deps
  // that included it. The ref-of-latest-callback pattern is the standard
  // React fix — `cancel` reads the most recent onCancel without depending on
  // it in its own dep array. Caller-side memoization is no longer required.
  const onCancelRef = useRef(onCancelCallback);
  useEffect(() => {
    onCancelRef.current = onCancelCallback;
  }, [onCancelCallback]);

  const open = useCallback(() => {
    setIsEditing(true);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    // TD-188: setters run synchronously (React 19 batches in event handlers),
    // then onCancel fires. Callers MUST NOT read isEditing inside onCancel —
    // see hook-level JSDoc for the migration rationale.
    // TD-191: onCancelRef.current resolves to the LATEST onCancel at call
    // time, not the one captured at memoization time.
    setIsEditing(false);
    setError(null);
    onCancelRef.current?.();
  }, []);

  const onSuccess = useCallback(() => {
    setIsEditing(false);
    setError(null);
    if (onSuccessRefresh) {
      router.refresh();
    }
  }, [onSuccessRefresh, router]);

  const onError = useCallback((err: { message: string }) => {
    setError(err.message);
  }, []);

  return {
    isEditing,
    error,
    open,
    cancel,
    handlers: { onSuccess, onError },
  };
}
