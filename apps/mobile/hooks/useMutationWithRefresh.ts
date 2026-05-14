/**
 * useMutationWithRefresh
 *
 * Thin wrapper around tRPC's `useMutation` that automatically calls a
 * `refresh` function (either a query `refetch` or a tRPC `utils.*.invalidate`)
 * after every successful mutation.  Additional `onSuccess` logic can be
 * supplied via `options.onSuccess`; it runs AFTER the refresh so the caller
 * sees fresh data.
 *
 * Invariant-preserving — no external behaviour change.  Replaces the
 * repetitive `onSuccess: () => refetch()` pattern across 7 screens (OOP-011).
 *
 * Usage:
 *
 *   // Simple refetch
 *   const deleteMut = useMutationWithRefresh(
 *     trpc.expenses.delete.useMutation,
 *     refetch,
 *   );
 *
 *   // Refetch + extra onSuccess work
 *   const inviteMut = useMutationWithRefresh(
 *     trpc.memberships.invite.useMutation,
 *     refetch,
 *     {
 *       onSuccess: () => {
 *         setShowInvite(false);
 *         Alert.alert("Invite sent");
 *       },
 *     },
 *   );
 */

type MutationFactory<TInput, TOutput> = (opts: {
  onSuccess?: (data: TOutput) => void;
  onError?: (err: unknown) => void;
}) => {
  mutate: (input: TInput, opts?: { onSuccess?: () => void }) => void;
  mutateAsync: (input: TInput) => Promise<TOutput>;
  isPending: boolean;
  error: unknown;
  reset: () => void;
};

type UseMutationWithRefreshOptions<TOutput> = {
  onSuccess?: (data: TOutput) => void;
  onError?: (err: unknown) => void;
};

/**
 * Wrap a tRPC `useMutation` hook so that `refresh()` is always called on
 * success.  Returns the mutation object unchanged so call-sites can still
 * destructure `{ mutate, isPending, error }`.
 *
 * @param useMutationHook  - tRPC mutation hook, e.g. `trpc.foo.bar.useMutation`
 * @param refresh          - Function to refresh data: query `refetch` or
 *                           `() => utils.foo.list.invalidate()`
 * @param options          - Optional `onSuccess` / `onError` callbacks.
 *                           `onSuccess` fires after `refresh`.
 */
export function useMutationWithRefresh<TInput, TOutput>(
  useMutationHook: (opts: {
    onSuccess?: (data: TOutput) => void;
    onError?: (err: unknown) => void;
  }) => ReturnType<MutationFactory<TInput, TOutput>>,
  refresh: () => void,
  options?: UseMutationWithRefreshOptions<TOutput>,
): ReturnType<MutationFactory<TInput, TOutput>> {
  return useMutationHook({
    onSuccess: (data: TOutput) => {
      refresh();
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
}
