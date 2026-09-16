import { useEffect, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { media } from '@/shared/ui/media.ts'
import { describeStatus, type Tone } from './model/describeStatus.ts'
import type { LiveSyncStatus } from './model/liveOrgSync.ts'

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
`

const Root = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space(2)};
  padding: ${({ theme }) => `${theme.space(1)} ${theme.space(3)}`};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: 999px;
  background: ${({ theme }) => theme.color.surface};
  font-size: ${({ theme }) => theme.font.size.sm};
  white-space: nowrap;

  /* На телефоне пояснение («переподключимся, когда связь вернётся») уходит второй строкой,
     иначе индикатор шире экрана и страница прокручивается по горизонтали. */
  @media ${media.narrow} {
    flex-wrap: wrap;
    row-gap: 0;
    max-width: 100%;
    border-radius: ${({ theme }) => theme.radius.md};
  }
`

const Dot = styled.span<{ $tone: Tone }>`
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: ${({ theme, $tone }) =>
    ({
      ok: theme.color.performance.high,
      pending: theme.color.performance.mid,
      danger: theme.color.danger,
      muted: theme.color.textMuted,
    })[$tone]};
  animation: ${({ $tone }) => ($tone === 'pending' ? pulse : 'none')} 1.2s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Detail = styled.span`
  color: ${({ theme }) => theme.color.textMuted};
  font-variant-numeric: tabular-nums;

  &::before {
    content: '· ';
  }

  @media ${media.narrow} {
    flex-basis: 100%;
    /* Выравнивание под текстом статуса: ширина точки плюс отступ. */
    padding-left: calc(8px + ${({ theme }) => theme.space(2)});
    white-space: normal;

    &::before {
      content: none;
    }
  }
`

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
    <Root>
      <Dot $tone={view.tone} aria-hidden="true" />
      <span role="status">{view.label}</span>
      {view.detail && <Detail aria-hidden="true">{view.detail}</Detail>}
    </Root>
  )
}
