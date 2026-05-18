"use client";

import { useCallback, useState } from "react";
import { flushSync } from "react-dom";
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
 * ## Cancel contract (LOCKED — TD-186)
 *
 * `cancel()` flips `isEditing` to `false` and clears `error` FIRST, THEN
 * invokes the optional `onCancel` callback. Callers see the post-close state
 * when running their reset side-effects — any state-derived rendering inside
 * `onCancel` observes the closed UI. If a niche caller needs pre-close
 * visibility we can add a separate `onBeforeCancel` arg later.
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

  const open = useCallback(() => {
    setIsEditing(true);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    // Ordering LOCKED (TD-186): flip closed-state FIRST so onCancel observes
    // isEditing === false and error === null when it reads from React state
    // via a fresh render. `flushSync` commits the setters synchronously so
    // any caller-supplied onCancel that re-reads React state (or triggers
    // its own renders) sees the post-close values.
    flushSync(() => {
      setIsEditing(false);
      setError(null);
    });
    onCancelCallback?.();
  }, [onCancelCallback]);

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
