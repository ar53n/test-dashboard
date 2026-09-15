import type { LiveSyncStatus } from './liveOrgSync.ts'

export type Tone = 'ok' | 'pending' | 'danger' | 'muted'

export interface IndicatorView {
  tone: Tone
  label: string
  /** Меняющаяся часть (обратный отсчёт) не озвучивается: иначе скринридер читал бы её каждую секунду. */
  detail?: string
}

export function describeStatus(status: LiveSyncStatus | null, now: number): IndicatorView {
  if (!status) return { tone: 'muted', label: 'Live-обновления выключены' }
  const { connection, phase } = status
  switch (connection.kind) {
    case 'idle':
    case 'connecting':
      return { tone: 'pending', label: 'Подключение…' }
    case 'offline':
      return { tone: 'danger', label: 'Нет сети', detail: 'переподключимся, когда связь вернётся' }
    case 'reconnecting': {
      // Остаток не больше выбранной задержки: в первом кадре после смены статуса `now` может быть устаревшим.
      const remainingMs = Math.min(connection.delayMs, connection.retryAt - now)
      const seconds = Math.max(0, Math.ceil(remainingMs / 1000))
      return {
        tone: 'danger',
        label: 'Нет связи с сервером',
        detail: seconds > 0 ? `повтор через ${seconds} с · попытка ${connection.attempt}` : `попытка ${connection.attempt}…`,
      }
    }
    case 'open':
      if (phase === 'live') return { tone: 'ok', label: 'В реальном времени' }
      if (phase === 'resyncing') return { tone: 'pending', label: 'Синхронизация…' }
      return { tone: 'pending', label: 'Подключено' }
  }
}
