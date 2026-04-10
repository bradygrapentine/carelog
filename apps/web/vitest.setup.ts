import '@testing-library/jest-dom'

// Make window.location.href writable in jsdom so redirect tests can assert on it.
// Guard with typeof check — node-environment tests don't have window.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'location', {
    value: { href: 'http://localhost:3000/', assign: vi.fn(), replace: vi.fn() },
    writable: true,
  })
}