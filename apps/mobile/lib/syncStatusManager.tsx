import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { getQueue } from '../store/offlineQueue'

type SyncStatus = 'synced' | 'pending' | 'offline'

type SyncStatusContextValue = SyncStatus

const POLL_INTERVAL_MS = 2000

const SyncStatusContext = createContext<SyncStatusContextValue>('synced')

export function useSyncStatusContext(): SyncStatusContextValue {
  return useContext(SyncStatusContext)
}

export function SyncStatusProvider({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const [isConnected, setIsConnected] = useState(true)
  const [queueLength, setQueueLength] = useState(0)

  // Single interval ref — cleared/restarted on AppState changes.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)

  function startTimer() {
    if (intervalRef.current !== null) return
    intervalRef.current = setInterval(() => {
      getQueue().then((q) => setQueueLength(q.length))
    }, POLL_INTERVAL_MS)
  }

  function stopTimer() {
    if (intervalRef.current === null) return
    clearInterval(intervalRef.current)
    intervalRef.current = null
  }

  useEffect(() => {
    // NetInfo subscription
    const unsubNetInfo = NetInfo.addEventListener((state) => {
      setIsConnected(!!state.isConnected)
    })

    // Start timer immediately (app is foregrounded at mount)
    startTimer()

    // AppState subscription — pause timer when backgrounded
    const appStateSub = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        const prev = appStateRef.current
        appStateRef.current = nextState

        if (
          nextState === 'background' ||
          nextState === 'inactive'
        ) {
          stopTimer()
        } else if (
          nextState === 'active' &&
          prev !== 'active'
        ) {
          // Poll immediately on resume, then restart cadence
          getQueue().then((q) => setQueueLength(q.length))
          startTimer()
        }
      },
    )

    return () => {
      unsubNetInfo()
      stopTimer()
      appStateSub.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  let status: SyncStatus
  if (!isConnected) {
    status = 'offline'
  } else if (queueLength > 0) {
    status = 'pending'
  } else {
    status = 'synced'
  }

  return (
    <SyncStatusContext.Provider value={status}>
      {children}
    </SyncStatusContext.Provider>
  )
}
