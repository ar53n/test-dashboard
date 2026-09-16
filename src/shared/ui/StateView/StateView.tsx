import type { ReactNode } from 'react'
import { Button } from '../Button/index.ts'
import { VisuallyHidden } from '../VisuallyHidden/index.ts'
import * as S from './StateView.styled.ts'

const SKELETON_ROWS = {
  tree: [
    { indent: 0, width: 45 },
    { indent: 1, width: 55 },
    { indent: 2, width: 60 },
    { indent: 2, width: 50 },
    { indent: 1, width: 40 },
    { indent: 0, width: 50 },
    { indent: 1, width: 58 },
  ],
  table: Array.from({ length: 8 }, () => ({ indent: 0, width: 100 })),
}

export function LoadingState({ label, variant = 'tree' }: { label: string; variant?: keyof typeof SKELETON_ROWS }) {
  return (
    <S.SkeletonList role="status" aria-live="polite">
      <VisuallyHidden>{label}</VisuallyHidden>
      {SKELETON_ROWS[variant].map((row, i) => (
        <S.SkeletonRow key={i} $indent={row.indent} $width={row.width} aria-hidden="true" />
      ))}
    </S.SkeletonList>
  )
}

interface ErrorStateProps {
  title: string
  description: string
  details?: readonly string[]
  onRetry?: () => void
}

export function ErrorState({ title, description, details = [], onRetry }: ErrorStateProps) {
  return (
    <S.Message $tone="danger" role="alert">
      <S.Title $tone="danger">{title}</S.Title>
      <S.Description>{description}</S.Description>
      {details.length > 0 && (
        <S.Details>
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </S.Details>
      )}
      {onRetry && (
        <Button type="button" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </S.Message>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <S.Message $tone="neutral" role="status">
      <S.Title $tone="neutral">{title}</S.Title>
      <S.Description>{description}</S.Description>
      {action}
    </S.Message>
  )
}
