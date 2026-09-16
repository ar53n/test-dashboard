import { useEffect, useState } from 'react'
import * as S from './ConnectionIndicator.styled.ts'
import { describeStatus } from './model/describeStatus.ts'
import type { LiveSyncStatus } from './model/liveOrgSync.ts'

export function ConnectionIndicator({ status }: { status: LiveSyncStatus | null }) {
  const [now, setNow] = useState(() => Date.now())
  const reconnecting = status?.connection.kind === 'reconnecting'

  // Обратный отсчёт тикает только пока ждём переподключения.
  useEffect(() => {
    if (!reconnecting) return
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const timer = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [reconnecting, status])

  const view = describeStatus(status, now)
  return (
    <S.Root>
      <S.Dot $tone={view.tone} aria-hidden="true" />
      <span role="status">{view.label}</span>
      {view.detail && <S.Detail aria-hidden="true">{view.detail}</S.Detail>}
    </S.Root>
  )
}
