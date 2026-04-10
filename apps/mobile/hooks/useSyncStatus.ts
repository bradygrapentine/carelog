import { useEffect, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { getQueue } from '../store/offlineQueue'

type SyncStatus = 'synced' | 'pending' | 'offline'

export function useSyncStatus(): SyncStatus {
  const [isConnected, setIsConnected] = useState(true)
  const [queueLength, setQueueLength] = useState(0)

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsConnected(!!state.isConnected)
    })
    return unsub
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      getQueue().then((q) => setQueueLength(q.length))
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  if (!isConnected) return 'offline'
  if (queueLength > 0) return 'pending'
  return 'synced'
}
