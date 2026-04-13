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
