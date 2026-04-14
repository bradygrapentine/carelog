/**
 * PHI boundary tests for sentryBreadcrumbLink (ON-33)
 *
 * Contract: Sentry breadcrumbs must NEVER include input data or response data.
 * Only structural metadata (path, type, error code) is permitted.
 */

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
}))

import * as Sentry from '@sentry/react-native'
import { observable } from '@trpc/server/observable'
import { sentryBreadcrumbLink } from '../trpc'

const mockAddBreadcrumb = Sentry.addBreadcrumb as jest.MockedFunction<
  typeof Sentry.addBreadcrumb
>

// Helper: build a mock "next" that immediately emits an error
function makeErrorNext(errCode: string) {
  return (_args: unknown) =>
    observable<unknown, { data: { code: string }; message: string }>(
      (observer) => {
        observer.error({ data: { code: errCode }, message: 'test error' })
      }
    )
}

// Helper: build a mock "next" that immediately emits a success value
function makeSuccessNext(value: unknown) {
  return (_args: unknown) =>
    observable<unknown, never>((observer) => {
      observer.next({ result: { data: value } })
      observer.complete()
    })
}

const PHI_INPUT = { body: 'PHI content', email: 'user@test.com' }

const PHI_OP = {
  path: 'careEvents.insert',
  type: 'mutation' as const,
  input: PHI_INPUT,
  // minimal shape required by TRPCLink op
  id: 1,
  context: {},
}

function runLink(
  next: ReturnType<typeof makeErrorNext> | ReturnType<typeof makeSuccessNext>
) {
  return new Promise<void>((resolve, reject) => {
    const linkFn = (sentryBreadcrumbLink as unknown as () => (args: { next: typeof next; op: typeof PHI_OP }) => ReturnType<typeof observable>)()
    const obs = linkFn({ next, op: PHI_OP })
    obs.subscribe({
      next: () => {},
      error: (err: unknown) => resolve(),   // error path resolves so we can assert
      complete: () => resolve(),
    })
  })
}

function runLinkAndCaptureError(
  next: ReturnType<typeof makeErrorNext>
): Promise<unknown> {
  return new Promise((resolve) => {
    const linkFn = (sentryBreadcrumbLink as unknown as () => (args: { next: typeof next; op: typeof PHI_OP }) => ReturnType<typeof observable>)()
    const obs = linkFn({ next, op: PHI_OP })
    obs.subscribe({
      next: () => {},
      error: (err: unknown) => resolve(err),
      complete: () => resolve(null),
    })
  })
}

beforeEach(() => {
  mockAddBreadcrumb.mockClear()
})

// ─── Test 1 ──────────────────────────────────────────────────────────────────
test('1. captures breadcrumb on error', async () => {
  await runLink(makeErrorNext('UNAUTHORIZED'))
  expect(mockAddBreadcrumb).toHaveBeenCalledTimes(1)
})

// ─── Test 2 ──────────────────────────────────────────────────────────────────
test('2. breadcrumb message equals op.path', async () => {
  await runLink(makeErrorNext('UNAUTHORIZED'))
  const [call] = mockAddBreadcrumb.mock.calls
  expect(call[0].message).toBe(PHI_OP.path)
})

// ─── Test 3 ──────────────────────────────────────────────────────────────────
test('3. breadcrumb data.type equals op.type', async () => {
  await runLink(makeErrorNext('UNAUTHORIZED'))
  const [call] = mockAddBreadcrumb.mock.calls
  expect(call[0].data?.type).toBe(PHI_OP.type)
})

// ─── Test 4 ──────────────────────────────────────────────────────────────────
test('4. breadcrumb data.code equals tRPC error code', async () => {
  await runLink(makeErrorNext('UNAUTHORIZED'))
  const [call] = mockAddBreadcrumb.mock.calls
  expect(call[0].data?.code).toBe('UNAUTHORIZED')
})

// ─── Test 5 ──────────────────────────────────────────────────────────────────
test('5. breadcrumb does NOT contain PHI from op.input', async () => {
  await runLink(makeErrorNext('UNAUTHORIZED'))
  const allCallArgs = JSON.stringify(mockAddBreadcrumb.mock.calls)
  expect(allCallArgs).not.toContain('PHI content')
  expect(allCallArgs).not.toContain('user@test.com')
})

// ─── Test 6 ──────────────────────────────────────────────────────────────────
test('6. breadcrumb category is "trpc"', async () => {
  await runLink(makeErrorNext('UNAUTHORIZED'))
  const [call] = mockAddBreadcrumb.mock.calls
  expect(call[0].category).toBe('trpc')
})

// ─── Test 7 ──────────────────────────────────────────────────────────────────
test('7. breadcrumb level is "error"', async () => {
  await runLink(makeErrorNext('UNAUTHORIZED'))
  const [call] = mockAddBreadcrumb.mock.calls
  expect(call[0].level).toBe('error')
})

// ─── Test 8 ──────────────────────────────────────────────────────────────────
test('8. no breadcrumb on success', async () => {
  await runLink(makeSuccessNext({ id: 'abc-123' }))
  expect(mockAddBreadcrumb).not.toHaveBeenCalled()
})

// ─── Test 9 ──────────────────────────────────────────────────────────────────
test('9. error is re-emitted (not swallowed)', async () => {
  const originalErr = { data: { code: 'FORBIDDEN' }, message: 'test error' }
  const received = await runLinkAndCaptureError(makeErrorNext('FORBIDDEN'))
  expect(received).toEqual(originalErr)
  // Breadcrumb was also captured
  expect(mockAddBreadcrumb).toHaveBeenCalledTimes(1)
})
