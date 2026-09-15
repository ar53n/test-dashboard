import styled from 'styled-components'
import { getPerformanceLabel, getPerformanceLevel, type PerformanceLevel } from '@/entities/org/model/performance.ts'
import { formatDecimal } from '@/shared/lib/format.ts'
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden.ts'

const Wrapper = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.space(1.5)};
  min-width: 3.25em;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.color.textMuted};
`

const Dot = styled.span<{ $level: PerformanceLevel | 'none' }>`
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 50%;
  background: ${({ theme, $level }) => ($level === 'none' ? theme.color.border : theme.color.performance[$level])};
`

interface PerformanceIndicatorProps {
  /** `null` — у подразделения нет сотрудников, эффективность не определена. */
  value: number | null
  /** Средние значения показываются с десятыми, собственные — целыми. */
  precise?: boolean
}

/** Цвет дублируется числом и скрытой подписью, чтобы индикатор не зависел только от цвета. */
export function PerformanceIndicator({ value, precise = false }: PerformanceIndicatorProps) {
  if (value === null) {
    return (
      <Wrapper title="Эффективность не определена: нет сотрудников">
        <Dot $level="none" aria-hidden="true" />
        <span aria-hidden="true">—</span>
        <VisuallyHidden>Эффективность не определена</VisuallyHidden>
      </Wrapper>
    )
  }

  // Цвет считается от показанного числа: 74,96 → «75,0» не должно гореть жёлтым.
  const shown = precise ? Math.round(value * 10) / 10 : Math.round(value)
  const text = precise ? formatDecimal(shown) : String(shown)
  const label = getPerformanceLabel(shown)
  return (
    <Wrapper title={`Эффективность: ${text} из 100 (${label})`}>
      <Dot $level={getPerformanceLevel(shown)} aria-hidden="true" />
      <VisuallyHidden>Эффективность</VisuallyHidden>
      {text}
      <VisuallyHidden>из 100, {label}</VisuallyHidden>
    </Wrapper>
  )
}
