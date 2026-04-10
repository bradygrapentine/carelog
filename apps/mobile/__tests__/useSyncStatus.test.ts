import { renderHook, act } from '@testing-library/react-native'
import { useSyncStatus } from '../hooks/useSyncStatus'

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((cb: (s: { isConnected: boolean }) => void) => {
    cb({ isConnected: true })
    return jest.fn()
  }),
}))

jest.mock('../store/offlineQueue', () => ({
  getQueue: jest.fn().mockResolvedValue([]),
}))

describe('useSyncStatus', () => {
  it('returns synced when connected and queue is empty', () => {
    const { result } = renderHook(() => useSyncStatus())
    expect(result.current).toBe('synced')
  })

  it('returns pending when queue has items', async () => {
    const { getQueue } = require('../store/offlineQueue') as { getQueue: jest.Mock }
    getQueue.mockResolvedValue([{ id: '1' }])
    const { result } = renderHook(() => useSyncStatus())
    await act(async () => { await new Promise((r) => setTimeout(r, 2100)) })
    expect(result.current).toBe('pending')
  })
})
