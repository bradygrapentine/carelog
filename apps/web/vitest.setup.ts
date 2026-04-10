import '@testing-library/jest-dom'

// posthog-js accesses browser APIs (window.location hash) on import.
// Mock it globally so component tests that import posthog don't crash.
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
}))

// Make window.location.href writable in jsdom so redirect tests can assert on it.
// Guard with typeof check — node-environment tests don't have window.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'location', {
    value: { href: 'http://localhost:3000/', assign: vi.fn(), replace: vi.fn() },
    writable: true,
  })
}