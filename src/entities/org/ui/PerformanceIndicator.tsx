import styled from 'styled-components'
import { getPerformanceLabel, getPerformanceLevel, type PerformanceLevel } from '@/entities/org/model/performance.ts'
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden.ts'

const Wrapper = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space(1.5)};
  min-width: 3.25em;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.color.textMuted};
`

const Dot = styled.span<{ $level: PerformanceLevel }>`
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 50%;
  background: ${({ theme, $level }) => theme.color.performance[$level]};
`

/** Цвет дублируется числом и скрытой подписью, чтобы индикатор не зависел только от цвета. */
export function PerformanceIndicator({ value }: { value: number }) {
  const rounded = Math.round(value)
  return (
    <Wrapper title={`Эффективность: ${rounded} из 100 (${getPerformanceLabel(value)})`}>
      <Dot $level={getPerformanceLevel(value)} aria-hidden="true" />
      <VisuallyHidden>Эффективность</VisuallyHidden>
      {rounded}
      <VisuallyHidden>из 100, {getPerformanceLabel(value)}</VisuallyHidden>
    </Wrapper>
  )
}
