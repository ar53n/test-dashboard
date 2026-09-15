export type PerformanceLevel = 'low' | 'mid' | 'high'

export const PERFORMANCE_THRESHOLDS = { mid: 50, high: 75 } as const

export function getPerformanceLevel(value: number): PerformanceLevel {
  if (value >= PERFORMANCE_THRESHOLDS.high) return 'high'
  if (value >= PERFORMANCE_THRESHOLDS.mid) return 'mid'
  return 'low'
}

const LEVEL_LABELS: Record<PerformanceLevel, string> = {
  low: 'низкая',
  mid: 'средняя',
  high: 'высокая',
}

export const getPerformanceLabel = (value: number) => LEVEL_LABELS[getPerformanceLevel(value)]
