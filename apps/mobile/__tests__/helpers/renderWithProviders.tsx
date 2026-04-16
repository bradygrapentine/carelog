import { render, type RenderOptions } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider } from "../../context/AppContext";
import type { ReactElement } from "react";

type ProviderOptions = {
  orgId?: string;
  recipientId?: string;
  role?: string;
};

// ts-prune-ignore-next // test helper
export function renderWithProviders(
  ui: ReactElement,
  options?: ProviderOptions & Omit<RenderOptions, "wrapper">,
) {
  const {
    orgId = "org-1",
    recipientId = "r-1",
    role = "coordinator",
    ...renderOptions
  } = options ?? {};

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AppProvider
          initialOrgId={orgId}
          initialRecipientId={recipientId}
          initialRole={role}
        >
          {children}
        </AppProvider>
      </QueryClientProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), queryClient };
}
