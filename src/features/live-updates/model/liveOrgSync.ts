import { LIVE_PATH } from '@shared/contract.ts'
import type { QueryClient } from '@tanstack/react-query'
import { orgTreeQueryKey, orgTreeQueryOptions, setOrgTreePushed } from '@/entities/org/api/orgTreeQuery.ts'
import { applyPatch } from '@/entities/org/model/applyPatch.ts'
import type { OrgModel } from '@/entities/org/model/orgModel.ts'
import { LiveClient, type ConnectionStatus, type LiveClientOptions } from './LiveClient.ts'
import { SyncController, type SyncPhase, type SyncTarget } from './SyncController.ts'

export interface LiveSyncStatus {
  readonly connection: ConnectionStatus
  readonly phase: SyncPhase
}

export function liveUrl(location: Pick<Location, 'protocol' | 'host'> = window.location): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${LIVE_PATH}`
}

/** Адаптер SyncController к кэшу TanStack Query. */
export function createQueryCacheTarget(client: QueryClient): SyncTarget {
  const queryKey = orgTreeQueryKey()
  const findQuery = () => client.getQueryCache().find({ queryKey, exact: true })

  return {
    getModel: () => client.getQueryData<OrgModel>(queryKey),
    applyPatch(patch) {
      client.setQueryData<OrgModel>(queryKey, (model) => (model ? applyPatch(model, patch) : model))
    },
    async fetchSnapshot() {
      if (!findQuery()) {
        await client.fetchQuery(orgTreeQueryOptions())
        return
      }
      // cancelRefetch (по умолчанию true) отменяет параллельный запрос: нужен снимок, начатый сейчас.
      await client.refetchQueries({ queryKey, exact: true }, { throwOnError: true })
    },
    subscribeModel(listener) {
      return client.getQueryCache().subscribe((event) => {
        if (event.type === 'updated' && event.action.type === 'success' && event.query === findQuery()) listener()
      })
    },
    setPushed: (pushed) => setOrgTreePushed(client, pushed),
  }
}

/** Связка WebSocket-клиента и контроллера синхронизации с единым статусом для UI. */
export function createLiveOrgSync(client: QueryClient, options: Partial<LiveClientOptions> = {}) {
  const controller = new SyncController(createQueryCacheTarget(client))
  const liveClient = new LiveClient({
    url: liveUrl(),
    ...options,
    onMessage: (message) => controller.handleMessage(message),
    onDisconnect: () => controller.handleDisconnect(),
  })

  let status: LiveSyncStatus = { connection: liveClient.getStatus(), phase: controller.getPhase() }
  const listeners = new Set<() => void>()
  const update = () => {
    const connection = liveClient.getStatus()
    const phase = controller.getPhase()
    if (connection === status.connection && phase === status.phase) return
    status = { connection, phase }
    for (const listener of listeners) listener()
  }
  liveClient.subscribe(update)
  controller.subscribe(update)

  return {
    start() {
      controller.start()
      liveClient.start()
    },
    stop() {
      liveClient.stop()
      controller.stop()
    },
    getStatus: (): LiveSyncStatus => status,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export type LiveOrgSync = ReturnType<typeof createLiveOrgSync>
