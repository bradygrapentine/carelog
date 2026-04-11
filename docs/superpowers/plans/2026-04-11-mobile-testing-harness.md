# Mobile Testing Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build comprehensive Jest + RTL test coverage for the mobile app: shared test utilities, hook tests, and screen-level rendering tests for all tab screens and auth flows.

**Architecture:** Mock at the boundary (tRPC, NetInfo, SecureStore). Shared `renderWithProviders` wraps components in tRPC + QueryClient + AppContext. Each screen test verifies rendering with mocked data, empty states, loading states, and key user interactions.

**Tech Stack:** Jest, @testing-library/react-native, jest-expo

**Spec:** `docs/superpowers/specs/2026-04-11-mobile-offline-testing-watch-design.md`

**Prerequisite:** Complete `2026-04-11-mobile-offline-first.md` plan first (tests reference the generalized offline queue).

---

### Task 1: Create shared test utilities

**Files:**
- Create: `apps/mobile/__tests__/helpers/renderWithProviders.tsx`
- Create: `apps/mobile/__tests__/helpers/mockTrpc.ts`

- [ ] **Step 1: Create renderWithProviders helper**

Create `apps/mobile/__tests__/helpers/renderWithProviders.tsx`:

```typescript
import { render, type RenderOptions } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppProvider } from '../../context/AppContext'
import type { ReactElement } from 'react'

type ProviderOptions = {
  orgId?: string
  recipientId?: string
  role?: string
}

export function renderWithProviders(
  ui: ReactElement,
  options?: ProviderOptions & Omit<RenderOptions, 'wrapper'>,
) {
  const { orgId = 'org-1', recipientId = 'r-1', role = 'coordinator', ...renderOptions } = options ?? {}

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  })

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AppProvider initialOrgId={orgId} initialRecipientId={recipientId} initialRole={role}>
          {children}
        </AppProvider>
      </QueryClientProvider>
    )
  }

  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), queryClient }
}
```

Note: This requires a small modification to `AppContext.tsx` to accept initial values for testing. We'll do that in Step 3.

- [ ] **Step 2: Create mock tRPC helpers**

Create `apps/mobile/__tests__/helpers/mockTrpc.ts`:

```typescript
import { vi } from 'vitest'

// Common mock factories for tRPC queries and mutations
export function mockQuery<T>(data: T) {
  return {
    useQuery: () => ({
      data,
      isLoading: false,
      error: null,
      refetch: vi.fn?.() ?? jest.fn(),
    }),
  }
}

export function mockLoadingQuery() {
  return {
    useQuery: () => ({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    }),
  }
}

export function mockMutation() {
  const mutateAsync = jest.fn().mockResolvedValue({ id: 'new-1' })
  const mutate = jest.fn()
  return {
    useMutation: (opts?: { onSuccess?: () => void }) => ({
      mutateAsync,
      mutate: (...args: unknown[]) => {
        mutate(...args)
        mutateAsync(...args).then(() => opts?.onSuccess?.())
      },
      isPending: false,
    }),
    _mutateAsync: mutateAsync,
    _mutate: mutate,
  }
}

// Standard SecureStore mock
export const secureStoreMock = (() => {
  const store: Record<string, string> = {}
  return {
    getItemAsync: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      store[key] = value
      return Promise.resolve()
    }),
    deleteItemAsync: jest.fn((key: string) => {
      delete store[key]
      return Promise.resolve()
    }),
    _clear: () => Object.keys(store).forEach((k) => delete store[k]),
  }
})()

// Standard NetInfo mock
export const netInfoMock = {
  addEventListener: jest.fn((cb: (s: { isConnected: boolean }) => void) => {
    cb({ isConnected: true })
    return jest.fn()
  }),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}
```

- [ ] **Step 3: Update AppContext to accept initial values for testing**

Modify `apps/mobile/context/AppContext.tsx` — add optional initial props:

```typescript
import { createContext, useContext, useState } from 'react'

type AppContextValue = {
  orgId: string | null
  recipientId: string | null
  currentRole: string | null
  setOrg: (orgId: string, recipientId: string, role: string) => void
}

const AppContext = createContext<AppContextValue>({
  orgId: null,
  recipientId: null,
  currentRole: null,
  setOrg: () => {},
})

type AppProviderProps = {
  children: React.ReactNode
  initialOrgId?: string | null
  initialRecipientId?: string | null
  initialRole?: string | null
}

export function AppProvider({
  children,
  initialOrgId = null,
  initialRecipientId = null,
  initialRole = null,
}: AppProviderProps) {
  const [orgId, setOrgId] = useState<string | null>(initialOrgId)
  const [recipientId, setRecipientId] = useState<string | null>(initialRecipientId)
  const [currentRole, setCurrentRole] = useState<string | null>(initialRole)

  function setOrg(o: string, r: string, role: string) {
    setOrgId(o)
    setRecipientId(r)
    setCurrentRole(role)
  }

  return (
    <AppContext.Provider value={{ orgId, recipientId, currentRole, setOrg }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
```

- [ ] **Step 4: Run existing tests to verify nothing broke**

Run: `cd apps/mobile && npx jest --verbose`
Expected: PASS — existing tests unaffected

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/__tests__/helpers/ apps/mobile/context/AppContext.tsx
git commit -m "test(mobile): add shared test utilities and renderWithProviders helper"
```

---

### Task 2: Test journal screen

**Files:**
- Create: `apps/mobile/app/(app)/journal/__tests__/index.test.tsx`

- [ ] **Step 1: Write journal screen tests**

Create `apps/mobile/app/(app)/journal/__tests__/index.test.tsx`:

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import JournalScreen from '../index'

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

jest.mock('../../../../hooks/useSyncStatus', () => ({
  useSyncStatus: jest.fn().mockReturnValue('synced'),
}))

const mockWrite = jest.fn().mockResolvedValue(undefined)
jest.mock('../../../../hooks/useOfflineWrite', () => ({
  useOfflineWrite: () => ({ write: mockWrite }),
}))

const mockRefetch = jest.fn()
const mockTimeline = [
  {
    id: 'e1',
    event_type: 'journal',
    occurred_at: '2026-04-11T10:00:00Z',
    payload: { text: 'Mom had a good morning', mood: 'good' },
  },
  {
    id: 'e2',
    event_type: 'journal',
    occurred_at: '2026-04-11T08:00:00Z',
    payload: { text: 'Rough night, woke up twice', mood: 'difficult' },
  },
]

jest.mock('../../../../utils/trpc', () => ({
  trpc: {
    careEvents: {
      timeline: {
        useQuery: () => ({ data: mockTimeline, isLoading: false, refetch: mockRefetch }),
      },
      reactions: {
        useQuery: () => ({ data: { counts: {}, myReaction: null }, refetch: jest.fn() }),
      },
      react: { useMutation: () => ({ mutate: jest.fn() }) },
      unreact: { useMutation: () => ({ mutate: jest.fn() }) },
      insert: { useMutation: () => ({ mutateAsync: jest.fn() }) },
    },
    medications: {
      logAdministration: { useMutation: () => ({ mutateAsync: jest.fn() }) },
    },
    symptoms: {
      log: { useMutation: () => ({ mutateAsync: jest.fn() }) },
    },
  },
}))

jest.mock('../../../../context/AppContext', () => ({
  useApp: () => ({ orgId: 'org-1', recipientId: 'r-1', currentRole: 'coordinator' }),
}))

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}))

jest.mock('../../../../store/offlineQueue', () => ({
  getQueue: jest.fn().mockResolvedValue([]),
  enqueue: jest.fn(),
  dequeue: jest.fn(),
  incrementAttempts: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('JournalScreen', () => {
  it('renders timeline entries', () => {
    const { getByText } = render(<JournalScreen />)
    expect(getByText('Mom had a good morning')).toBeTruthy()
    expect(getByText('Rough night, woke up twice')).toBeTruthy()
  })

  it('renders empty state when no entries', () => {
    jest.spyOn(require('../../../../utils/trpc').trpc.careEvents.timeline, 'useQuery')
      .mockReturnValueOnce({ data: [], isLoading: false, refetch: jest.fn() })
    const { getByText } = render(<JournalScreen />)
    expect(getByText('No entries yet. Add the first one below.')).toBeTruthy()
  })

  it('shows mood tags in the input form', () => {
    const { getByText } = render(<JournalScreen />)
    expect(getByText('good')).toBeTruthy()
    expect(getByText('okay')).toBeTruthy()
    expect(getByText('difficult')).toBeTruthy()
    expect(getByText('crisis')).toBeTruthy()
  })

  it('submits a journal entry via offline write', async () => {
    const { getByPlaceholderText, getByText } = render(<JournalScreen />)
    const input = getByPlaceholderText("What's happening with care today?")
    fireEvent.changeText(input, 'New entry text')
    fireEvent.press(getByText('Add entry'))

    await waitFor(() => {
      expect(mockWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'journal',
          entry_kind: 'journal_entry',
          payload: { text: 'New entry text', mood: 'okay' },
        }),
      )
    })
  })

  it('shows offline banner when offline', () => {
    const { useSyncStatus } = require('../../../../hooks/useSyncStatus')
    useSyncStatus.mockReturnValue('offline')
    const { getByText } = render(<JournalScreen />)
    expect(getByText(/Offline/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd apps/mobile && npx jest app/\\(app\\)/journal/__tests__/index.test.tsx --verbose`
Expected: PASS — all 5 tests green

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/journal/__tests__/index.test.tsx
git commit -m "test(mobile): add journal screen rendering tests"
```

---

### Task 3: Test medications screen

**Files:**
- Create: `apps/mobile/app/(app)/medications/__tests__/index.test.tsx`

- [ ] **Step 1: Write medications screen tests**

Create `apps/mobile/app/(app)/medications/__tests__/index.test.tsx`:

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import MedicationsScreen from '../index'

jest.mock('../../../../utils/watchBridge', () => ({
  writeWatchData: jest.fn(),
}))

jest.mock('../../../../hooks/useSyncStatus', () => ({
  useSyncStatus: jest.fn().mockReturnValue('synced'),
}))

const mockWrite = jest.fn().mockResolvedValue(undefined)
jest.mock('../../../../hooks/useOfflineWrite', () => ({
  useOfflineWrite: () => ({ write: mockWrite }),
}))

const mockRefetch = jest.fn()
const mockScheduled = [
  {
    id: 'sched-1',
    scheduled_time: '08:00',
    medications: [{ id: 'med-1', drug_name: 'Metformin', dosage: '500mg' }],
  },
  {
    id: 'sched-2',
    scheduled_time: '14:00',
    medications: [{ id: 'med-2', drug_name: 'Lisinopril', dosage: '10mg' }],
  },
]

jest.mock('../../../../utils/trpc', () => ({
  trpc: {
    medications: {
      listScheduled: {
        useQuery: () => ({ data: mockScheduled, isLoading: false, refetch: mockRefetch }),
      },
      todayLog: {
        useQuery: () => ({ data: [] }),
      },
      logAdministration: { useMutation: () => ({ mutateAsync: jest.fn() }) },
    },
    careEvents: {
      insert: { useMutation: () => ({ mutateAsync: jest.fn() }) },
    },
    symptoms: {
      log: { useMutation: () => ({ mutateAsync: jest.fn() }) },
    },
  },
}))

jest.mock('../../../../context/AppContext', () => ({
  useApp: () => ({ orgId: 'org-1', recipientId: 'r-1' }),
}))

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}))

jest.mock('../../../../store/offlineQueue', () => ({
  getQueue: jest.fn().mockResolvedValue([]),
  enqueue: jest.fn(),
  dequeue: jest.fn(),
  incrementAttempts: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('MedicationsScreen', () => {
  it('renders scheduled medications', () => {
    const { getByText } = render(<MedicationsScreen />)
    expect(getByText('Metformin')).toBeTruthy()
    expect(getByText('500mg · 08:00')).toBeTruthy()
    expect(getByText('Lisinopril')).toBeTruthy()
    expect(getByText('10mg · 14:00')).toBeTruthy()
  })

  it('renders empty state when no medications', () => {
    jest.spyOn(require('../../../../utils/trpc').trpc.medications.listScheduled, 'useQuery')
      .mockReturnValueOnce({ data: [], isLoading: false, refetch: jest.fn() })
    const { getByText } = render(<MedicationsScreen />)
    expect(getByText('No medications scheduled for today.')).toBeTruthy()
  })

  it('shows Mark given button for unadministered meds', () => {
    const { getAllByText } = render(<MedicationsScreen />)
    const buttons = getAllByText('Mark given')
    expect(buttons).toHaveLength(2)
  })

  it('shows Given status for administered meds', () => {
    jest.spyOn(require('../../../../utils/trpc').trpc.medications.todayLog, 'useQuery')
      .mockReturnValueOnce({
        data: [{ medication_id: 'med-1', scheduled_time: '08:00', action: 'given' }],
      })
    const { getByText, getAllByText } = render(<MedicationsScreen />)
    expect(getByText('✓ Given')).toBeTruthy()
    expect(getAllByText('Mark given')).toHaveLength(1) // only Lisinopril
  })

  it('logs medication via offline write when Mark given pressed', async () => {
    const { getAllByText } = render(<MedicationsScreen />)
    fireEvent.press(getAllByText('Mark given')[0])

    await waitFor(() => {
      expect(mockWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'medication',
          entry_kind: 'medication_log',
          payload: expect.objectContaining({
            medication_id: 'med-1',
            action: 'given',
          }),
        }),
      )
    })
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd apps/mobile && npx jest app/\\(app\\)/medications/__tests__/index.test.tsx --verbose`
Expected: PASS — all 5 tests green

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/medications/__tests__/index.test.tsx
git commit -m "test(mobile): add medications screen rendering tests"
```

---

### Task 4: Test schedule screen

**Files:**
- Create: `apps/mobile/app/(app)/schedule/__tests__/index.test.tsx`

- [ ] **Step 1: Read the schedule screen to understand its exact UI**

Read `apps/mobile/app/(app)/schedule/index.tsx` fully before writing tests.

- [ ] **Step 2: Write schedule screen tests**

Create `apps/mobile/app/(app)/schedule/__tests__/index.test.tsx`:

```typescript
import { render } from '@testing-library/react-native'
import ScheduleScreen from '../index'

jest.mock('../../../../utils/watchBridge', () => ({
  writeWatchData: jest.fn(),
}))

jest.mock('../../../../context/AppContext', () => ({
  useApp: () => ({ orgId: 'org-1', recipientId: 'r-1' }),
}))

const mockShifts = [
  {
    id: 'shift-1',
    assignee_name: 'Dad',
    starts_at: '2026-04-11T08:00:00Z',
    ends_at: '2026-04-11T16:00:00Z',
  },
  {
    id: 'shift-2',
    assignee_name: 'Mom',
    starts_at: '2026-04-12T08:00:00Z',
    ends_at: '2026-04-12T16:00:00Z',
  },
]

jest.mock('../../../../utils/trpc', () => ({
  trpc: {
    shifts: {
      list: {
        useQuery: () => ({ data: mockShifts, isLoading: false }),
      },
    },
  },
}))

describe('ScheduleScreen', () => {
  it('renders shift list with assignee names', () => {
    const { getByText } = render(<ScheduleScreen />)
    expect(getByText('Dad')).toBeTruthy()
    expect(getByText('Mom')).toBeTruthy()
  })

  it('renders empty state when no shifts', () => {
    jest.spyOn(require('../../../../utils/trpc').trpc.shifts.list, 'useQuery')
      .mockReturnValueOnce({ data: [], isLoading: false })
    const { getByText } = render(<ScheduleScreen />)
    // Check for the empty state text — read from the actual screen
    expect(getByText(/no shifts/i)).toBeTruthy()
  })
})
```

Note: The exact empty state text and query shape should be verified by reading the screen first (Step 1). Adjust the mock and assertions to match.

- [ ] **Step 3: Run test to verify it passes**

Run: `cd apps/mobile && npx jest app/\\(app\\)/schedule/__tests__/index.test.tsx --verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/schedule/__tests__/index.test.tsx
git commit -m "test(mobile): add schedule screen rendering tests"
```

---

### Task 5: Test team screen

**Files:**
- Create: `apps/mobile/app/(app)/team/__tests__/index.test.tsx`

- [ ] **Step 1: Read the team screen to understand its exact UI**

Read `apps/mobile/app/(app)/team/index.tsx` fully before writing tests.

- [ ] **Step 2: Write team screen tests**

Create `apps/mobile/app/(app)/team/__tests__/index.test.tsx`:

```typescript
import { render, fireEvent } from '@testing-library/react-native'
import TeamScreen from '../index'

jest.mock('../../../../context/AppContext', () => ({
  useApp: () => ({ orgId: 'org-1', recipientId: 'r-1', currentRole: 'coordinator' }),
}))

const mockMembers = [
  { id: 'm1', display_name: 'Alice', role: 'coordinator', accepted_at: '2026-01-01' },
  { id: 'm2', display_name: 'Bob', role: 'caregiver', accepted_at: '2026-02-01' },
]

const mockMutate = jest.fn()
jest.mock('../../../../utils/trpc', () => ({
  trpc: {
    memberships: {
      list: {
        useQuery: () => ({ data: mockMembers, isLoading: false, refetch: jest.fn() }),
      },
    },
    invites: {
      create: {
        useMutation: (opts?: { onSuccess?: () => void }) => ({
          mutate: (...args: unknown[]) => {
            mockMutate(...args)
            opts?.onSuccess?.()
          },
          isPending: false,
        }),
      },
    },
  },
}))

describe('TeamScreen', () => {
  it('renders team members', () => {
    const { getByText } = render(<TeamScreen />)
    expect(getByText('Alice')).toBeTruthy()
    expect(getByText('Bob')).toBeTruthy()
  })

  it('shows role badges', () => {
    const { getByText } = render(<TeamScreen />)
    expect(getByText('coordinator')).toBeTruthy()
    expect(getByText('caregiver')).toBeTruthy()
  })
})
```

Note: Read the actual team screen first (Step 1) to verify exact tRPC router names (`memberships.list` vs `team.list`) and UI text. Adjust mocks and assertions accordingly.

- [ ] **Step 3: Run test to verify it passes**

Run: `cd apps/mobile && npx jest app/\\(app\\)/team/__tests__/index.test.tsx --verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/team/__tests__/index.test.tsx
git commit -m "test(mobile): add team screen rendering tests"
```

---

### Task 6: Test auth screens (sign-in + verify)

**Files:**
- Create: `apps/mobile/app/(auth)/__tests__/sign-in.test.tsx`
- Create: `apps/mobile/app/(auth)/__tests__/verify.test.tsx`

- [ ] **Step 1: Read auth screens to understand exact flow**

Read `apps/mobile/app/(auth)/sign-in.tsx` and `apps/mobile/app/(auth)/verify.tsx` fully.

- [ ] **Step 2: Write sign-in screen tests**

Create `apps/mobile/app/(auth)/__tests__/sign-in.test.tsx`:

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import SignInScreen from '../sign-in'

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

const mockSignInWithOtp = jest.fn().mockResolvedValue({ error: null })
jest.mock('../../../utils/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: mockSignInWithOtp,
    },
  },
}))

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('SignInScreen', () => {
  it('renders email input and submit button', () => {
    const { getByPlaceholderText, getByText } = render(<SignInScreen />)
    // Verify exact text by reading the actual screen
    expect(getByPlaceholderText(/email/i)).toBeTruthy()
  })

  it('sends OTP on submit and navigates to verify', async () => {
    const { getByPlaceholderText, getByText } = render(<SignInScreen />)
    const input = getByPlaceholderText(/email/i)
    fireEvent.changeText(input, 'test@example.com')

    // Find and press the submit button — adjust text to match actual UI
    const submitButton = getByText(/sign in|continue|send code/i)
    fireEvent.press(submitButton)

    await waitFor(() => {
      expect(mockSignInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com' }),
      )
    })
  })
})
```

Note: Read the actual screen first (Step 1) to get exact placeholder text and button labels.

- [ ] **Step 3: Write verify screen tests**

Create `apps/mobile/app/(auth)/__tests__/verify.test.tsx`:

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import VerifyScreen from '../verify'

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
}))

const mockVerifyOtp = jest.fn().mockResolvedValue({ error: null, data: { session: { access_token: 'tok' } } })
jest.mock('../../../utils/supabase', () => ({
  supabase: {
    auth: {
      verifyOtp: mockVerifyOtp,
    },
  },
}))

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => {
    if (key === 'pending_email') return Promise.resolve('test@example.com')
    if (key === 'pending_invite_token') return Promise.resolve(null)
    return Promise.resolve(null)
  }),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('VerifyScreen', () => {
  it('renders OTP code input', () => {
    const { getByPlaceholderText } = render(<VerifyScreen />)
    // Adjust placeholder to match actual screen
    expect(getByPlaceholderText(/code|digit/i)).toBeTruthy()
  })

  it('verifies OTP and navigates on success', async () => {
    const { getByPlaceholderText, getByText } = render(<VerifyScreen />)
    const input = getByPlaceholderText(/code|digit/i)
    fireEvent.changeText(input, '123456')

    // Find and press verify button
    const verifyButton = getByText(/verify|confirm|submit/i)
    fireEvent.press(verifyButton)

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          token: '123456',
          type: 'email',
        }),
      )
    })
  })
})
```

- [ ] **Step 4: Run all auth tests**

Run: `cd apps/mobile && npx jest app/\\(auth\\)/__tests__/ --verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(auth\)/__tests__/
git commit -m "test(mobile): add auth screen tests (sign-in + verify)"
```

---

### Task 7: Test symptoms and burnout screens

**Files:**
- Create: `apps/mobile/app/(app)/symptoms/__tests__/index.test.tsx`
- Create: `apps/mobile/app/(app)/burnout/__tests__/index.test.tsx`

- [ ] **Step 1: Read symptoms and burnout screens**

Read `apps/mobile/app/(app)/symptoms/index.tsx` and `apps/mobile/app/(app)/burnout/index.tsx` fully.

- [ ] **Step 2: Write symptoms screen tests**

Create `apps/mobile/app/(app)/symptoms/__tests__/index.test.tsx` following the same pattern as medications tests — mock tRPC query, verify list renders, verify empty state. Read the actual screen first to get exact tRPC router name and UI text.

- [ ] **Step 3: Write burnout screen tests**

Create `apps/mobile/app/(app)/burnout/__tests__/index.test.tsx` following the same pattern — mock tRPC query, verify list renders, verify coordinator vs caregiver view. Read the actual screen first.

- [ ] **Step 4: Run tests**

Run: `cd apps/mobile && npx jest app/\\(app\\)/symptoms/__tests__/ app/\\(app\\)/burnout/__tests__/ --verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/symptoms/__tests__/ apps/mobile/app/\(app\)/burnout/__tests__/
git commit -m "test(mobile): add symptoms and burnout screen tests"
```

---

### Task 8: Add GitHub Actions CI workflow for mobile tests

**Files:**
- Create: `.github/workflows/mobile-tests.yml`

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/mobile-tests.yml`:

```yaml
name: Mobile Tests

on:
  push:
    branches: [feature/ui-redesign, main]
    paths:
      - 'apps/mobile/**'
      - 'packages/**'
  pull_request:
    branches: [main]
    paths:
      - 'apps/mobile/**'
      - 'packages/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Run mobile tests
        run: pnpm --filter mobile test -- --ci --coverage

      - name: Typecheck mobile
        run: cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/mobile-tests.yml
git commit -m "ci(mobile): add GitHub Actions workflow for mobile tests"
```

---

### Task 9: Run full test suite and verify coverage

**Files:** None (verification only)

- [ ] **Step 1: Run full mobile test suite**

Run: `cd apps/mobile && npx jest --verbose --coverage`
Expected: All tests pass. Coverage report shows hooks and screens covered.

- [ ] **Step 2: Run typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Verify test count**

Count total tests. Target: 25+ tests across 10+ test files (up from 3 files).

- [ ] **Step 4: Commit if any cleanup needed**

```bash
git add -A
git commit -m "test(mobile): testing harness complete — 25+ tests across 10+ files"
```
