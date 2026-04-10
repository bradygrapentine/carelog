// Mock the native module before importing watchBridge
jest.mock('../modules/carelog-watch', () => ({
  writeWatchData: jest.fn(),
}))

import { writeWatchData } from '../utils/watchBridge'

describe('watchBridge stub', () => {
  it('does not throw when called with partial data', () => {
    expect(() => writeWatchData({ nextShift: null })).not.toThrow()
  })

  it('does not throw when called with full data', () => {
    expect(() =>
      writeWatchData({
        nextShift: { assigneeName: 'Brady', startsAt: '2026-04-10T14:00:00Z' },
        nextMedication: { name: 'Lisinopril', dueAt: '2026-04-10T20:00:00Z' },
      }),
    ).not.toThrow()
  })

  it('does not throw when called with empty object', () => {
    expect(() => writeWatchData({})).not.toThrow()
  })
})
