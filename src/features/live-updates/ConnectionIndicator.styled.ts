import styled, { keyframes } from 'styled-components'
import { media } from '@/shared/ui/media.ts'
import type { Tone } from './model/describeStatus.ts'

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
`

export const Root = styled.div`
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

export const Dot = styled.span<{ $tone: Tone }>`
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

export const Detail = styled.span`
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
