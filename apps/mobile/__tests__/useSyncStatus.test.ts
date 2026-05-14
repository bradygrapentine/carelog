import { renderHook, act } from '@testing-library/react-native'
import React from 'react'
import { AppState } from 'react-native'
import { SyncStatusProvider } from '../lib/syncStatusManager'
import { useSyncStatus } from '../hooks/useSyncStatus'

type AppStateListener = (nextState: string) => void;
const appStateListeners: AppStateListener[] = []

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}))

const mockGetQueue = jest.fn()
jest.mock('../store/offlineQueue', () => ({
  getQueue: (...args: unknown[]) => mockGetQueue(...args),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(SyncStatusProvider, null, children)
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  appStateListeners.length = 0
  mockGetQueue.mockResolvedValue([])

  Object.defineProperty(AppState, 'currentState', {
    get: () => 'active',
    configurable: true,
  })

  ;(AppState.addEventListener as jest.Mock).mockImplementation(
    (_event: string, cb: AppStateListener) => {
      appStateListeners.push(cb)
      return { remove: jest.fn() }
    }
  )
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useSyncStatus', () => {
  it('returns synced when connected and queue is empty', () => {
    const { result } = renderHook(() => useSyncStatus(), { wrapper })
    expect(result.current).toBe('synced')
  })

  it('returns pending when queue has items', async () => {
    mockGetQueue.mockResolvedValue([{ id: '1' }])
    const { result } = renderHook(() => useSyncStatus(), { wrapper })
    await act(async () => {
      jest.advanceTimersByTime(2100)
      await Promise.resolve()
    })
    expect(result.current).toBe('pending')
  })
})
