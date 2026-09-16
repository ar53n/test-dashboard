import { getPerformanceLabel, getPerformanceLevel } from '@/entities/org/model/performance.ts'
import { formatDecimal } from '@/shared/lib/format.ts'
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden/index.ts'
import * as S from './PerformanceIndicator.styled.ts'

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
      <S.Wrapper title="Эффективность не определена: нет сотрудников">
        <S.Dot $level="none" aria-hidden="true" />
        <span aria-hidden="true">—</span>
        <VisuallyHidden>Эффективность не определена</VisuallyHidden>
      </S.Wrapper>
    )
  }

  // Цвет считается от показанного числа: 74,96 → «75,0» не должно гореть жёлтым.
  const shown = precise ? Math.round(value * 10) / 10 : Math.round(value)
  const text = precise ? formatDecimal(shown) : String(shown)
  const label = getPerformanceLabel(shown)
  return (
    <S.Wrapper title={`Эффективность: ${text} из 100 (${label})`}>
      <S.Dot $level={getPerformanceLevel(shown)} aria-hidden="true" />
      <VisuallyHidden>Эффективность</VisuallyHidden>
      {text}
      <VisuallyHidden>из 100, {label}</VisuallyHidden>
    </S.Wrapper>
  )
}
