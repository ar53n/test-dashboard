import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { createLiveOrgSync, type LiveSyncStatus } from './model/liveOrgSync.ts'

const noopSubscribe = () => () => {}
const getNull = () => null

/**
 * Подключает live-обновления оргструктуры на время жизни компонента.
 * `enabled = false` (демо-сценарии с фиксированным ответом) — соединение не открывается, статус `null`.
 */
export function useLiveOrgSync(enabled: boolean): LiveSyncStatus | null {
  const client = useQueryClient()
  const [sync] = useState(() => createLiveOrgSync(client))

  useEffect(() => {
    if (!enabled) return
    sync.start()
    return () => sync.stop()
  }, [sync, enabled])

  return useSyncExternalStore(enabled ? sync.subscribe : noopSubscribe, enabled ? sync.getStatus : getNull)
}
