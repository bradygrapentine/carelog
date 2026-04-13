import "@testing-library/jest-dom";

// posthog-js accesses browser APIs on import.
// Mock it globally so component tests that import posthog don't crash.
vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
}));

// next/navigation hooks require a Next.js runtime. Provide safe defaults so
// that components using them (e.g. SidebarProvider) can render in isolation.
// Individual tests can override this mock when they need to assert behavior.
vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<object>("next/navigation");
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    }),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
  };
});
