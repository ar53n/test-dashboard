import type { ReactNode } from 'react'
import styled, { keyframes } from 'styled-components'
import { Button } from './Button.ts'
import { VisuallyHidden } from './VisuallyHidden.ts'

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
`

const SkeletonList = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space(2)};
  padding: ${({ theme }) => theme.space(4)};
`

const SkeletonRow = styled.div<{ $indent: number; $width: number }>`
  height: 20px;
  margin-left: ${({ $indent }) => $indent * 20}px;
  width: ${({ $width }) => $width}%;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.skeleton};
  animation: ${pulse} 1.4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const SKELETON_ROWS = [
  { indent: 0, width: 45 },
  { indent: 1, width: 55 },
  { indent: 2, width: 60 },
  { indent: 2, width: 50 },
  { indent: 1, width: 40 },
  { indent: 0, width: 50 },
  { indent: 1, width: 58 },
]

export function LoadingState({ label }: { label: string }) {
  return (
    <SkeletonList role="status" aria-live="polite">
      <VisuallyHidden>{label}</VisuallyHidden>
      {SKELETON_ROWS.map((row, i) => (
        <SkeletonRow key={i} $indent={row.indent} $width={row.width} aria-hidden="true" />
      ))}
    </SkeletonList>
  )
}

const Message = styled.div<{ $tone: 'neutral' | 'danger' }>`
  display: grid;
  justify-items: start;
  gap: ${({ theme }) => theme.space(2)};
  margin: ${({ theme }) => theme.space(4)};
  padding: ${({ theme }) => theme.space(5)};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme, $tone }) => ($tone === 'danger' ? theme.color.dangerSurface : theme.color.background)};
`

const Title = styled.p<{ $tone: 'neutral' | 'danger' }>`
  margin: 0;
  font-weight: 600;
  color: ${({ theme, $tone }) => ($tone === 'danger' ? theme.color.danger : theme.color.text)};
`

const Description = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.color.textMuted};
`

const Details = styled.ul`
  margin: 0;
  padding-left: ${({ theme }) => theme.space(5)};
  color: ${({ theme }) => theme.color.textMuted};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
`

interface ErrorStateProps {
  title: string
  description: string
  details?: readonly string[]
  onRetry?: () => void
}

export function ErrorState({ title, description, details = [], onRetry }: ErrorStateProps) {
  return (
    <Message $tone="danger" role="alert">
      <Title $tone="danger">{title}</Title>
      <Description>{description}</Description>
      {details.length > 0 && (
        <Details>
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </Details>
      )}
      {onRetry && (
        <Button type="button" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </Message>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <Message $tone="neutral" role="status">
      <Title $tone="neutral">{title}</Title>
      <Description>{description}</Description>
      {action}
    </Message>
  )
}
