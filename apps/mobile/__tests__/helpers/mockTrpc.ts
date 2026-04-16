// Common mock factories for tRPC queries and mutations

// ts-prune-ignore-next // test helper
export function mockQuery<T>(data: T) {
  return {
    useQuery: () => ({
      data,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    }),
  };
}

// ts-prune-ignore-next // test helper
export function mockLoadingQuery() {
  return {
    useQuery: () => ({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    }),
  };
}

// ts-prune-ignore-next // test helper
export function mockMutation() {
  const mutateAsync = jest.fn().mockResolvedValue({ id: "new-1" });
  const mutate = jest.fn();
  return {
    useMutation: (opts?: { onSuccess?: () => void }) => ({
      mutateAsync,
      mutate: (...args: unknown[]) => {
        mutate(...args);
        mutateAsync(...args).then(() => opts?.onSuccess?.());
      },
      isPending: false,
    }),
    _mutateAsync: mutateAsync,
    _mutate: mutate,
  };
}

// Standard SecureStore mock
// ts-prune-ignore-next // test helper
export const secureStoreMock = (() => {
  const store: Record<string, string> = {};
  return {
    getItemAsync: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
    _clear: () => Object.keys(store).forEach((k) => delete store[k]),
  };
})();

// Standard NetInfo mock
// ts-prune-ignore-next // test helper
export const netInfoMock = {
  addEventListener: jest.fn((cb: (s: { isConnected: boolean }) => void) => {
    cb({ isConnected: true });
    return jest.fn();
  }),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
};
