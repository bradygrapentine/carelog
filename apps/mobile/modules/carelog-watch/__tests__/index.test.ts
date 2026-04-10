const mockNativeWrite = jest.fn()

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}))

jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn().mockReturnValue({ writeWatchData: mockNativeWrite }),
}))

// Import AFTER mocks are registered
const { writeWatchData } = require('../index')

describe('writeWatchData', () => {
  beforeEach(() => mockNativeWrite.mockReset())

  it('passes nextShift to native module', () => {
    writeWatchData({ nextShift: { assigneeName: 'Jane', startsAt: '2026-04-10T08:00:00Z' } })
    expect(mockNativeWrite).toHaveBeenCalledWith({
      nextShift: { assigneeName: 'Jane', startsAt: '2026-04-10T08:00:00Z' },
    })
  })

  it('passes nextMedication to native module', () => {
    writeWatchData({ nextMedication: { name: 'Metformin', dueAt: '08:00' } })
    expect(mockNativeWrite).toHaveBeenCalledWith({
      nextMedication: { name: 'Metformin', dueAt: '08:00' },
    })
  })

  it('strips null nextShift from payload', () => {
    writeWatchData({ nextShift: null, nextMedication: { name: 'Aspirin', dueAt: '09:00' } })
    expect(mockNativeWrite).toHaveBeenCalledWith({
      nextMedication: { name: 'Aspirin', dueAt: '09:00' },
    })
  })

  it('passes both fields when both provided', () => {
    writeWatchData({
      nextShift: { assigneeName: 'Bob', startsAt: '10:00' },
      nextMedication: { name: 'Lisinopril', dueAt: '10:30' },
    })
    expect(mockNativeWrite).toHaveBeenCalledWith({
      nextShift: { assigneeName: 'Bob', startsAt: '10:00' },
      nextMedication: { name: 'Lisinopril', dueAt: '10:30' },
    })
  })

  it('calls native exactly once per writeWatchData call', () => {
    writeWatchData({ nextShift: { assigneeName: 'Alice', startsAt: '11:00' } })
    expect(mockNativeWrite).toHaveBeenCalledTimes(1)
  })
})
