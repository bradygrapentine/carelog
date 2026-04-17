// Node environment setup for server router and API route tests
import { vi } from "vitest";

vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
}));

// Mock posthog-node (server-side PostHog) so server router tests don't
// require a real PostHog key or network connection.
vi.mock("posthog-node", () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    capture: vi.fn(),
    flush: vi.fn(),
    shutdown: vi.fn(),
  })),
}));

// Mock the posthog-server helper so any router importing it gets a no-op client.
vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: vi.fn(() => ({
    capture: vi.fn(),
    flush: vi.fn(),
    shutdown: vi.fn(),
  })),
}));
