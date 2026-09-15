import type { ComparisonOp, FilterSortKey, MetricField, OrgFilter } from '@shared/orgFilter.ts'
import { getLevelLabel } from '@/entities/org/model/level.ts'
import { formatBudget, formatDecimal, formatInteger } from '@/shared/lib/format.ts'

const METRIC_LABELS: Record<MetricField, string> = {
  totalHeadcount: 'Всего сотрудников',
  totalBudget: 'Бюджет суммарный',
  avgPerformance: 'Средняя эффективность',
  headcount: 'Сотрудников в самом подразделении',
  budget: 'Собственный бюджет',
  performance: 'Собственная эффективность',
}

const OP_LABELS: Record<ComparisonOp, string> = { gt: '>', gte: '≥', lt: '<', lte: '≤' }

const SORT_LABELS: Record<FilterSortKey, string> = {
  name: 'по названию',
  level: 'по уровню',
  totalHeadcount: 'по численности',
  totalBudget: 'по бюджету',
  avgPerformance: 'по эффективности',
}

function formatMetric(field: MetricField, value: number): string {
  if (field === 'totalBudget' || field === 'budget') return formatBudget(value)
  if (field === 'avgPerformance' || field === 'performance') return Number.isInteger(value) ? String(value) : formatDecimal(value)
  return formatInteger(value)
}

const pluralLevel = (level: number) => ({ 1: 'Дивизионы', 2: 'Отделы', 3: 'Команды' })[level] ?? getLevelLabel(level)

/** Человекочитаемые условия фильтра — для чипов под строкой поиска. */
export function describeFilter(filter: OrgFilter): string[] {
  const parts: string[] = []
  if (filter.levels) parts.push([...filter.levels].sort().map(pluralLevel).join(', '))
  if (filter.nameContains) parts.push(`Название содержит «${filter.nameContains}»`)
  if (filter.ancestorName) parts.push(`Входит в «${filter.ancestorName}»`)
  for (const metric of filter.metrics ?? []) {
    parts.push(`${METRIC_LABELS[metric.field]} ${OP_LABELS[metric.op]} ${formatMetric(metric.field, metric.value)}`)
  }
  if (filter.sort) parts.push(`Сортировка ${SORT_LABELS[filter.sort.key]} ${filter.sort.dir === 'asc' ? '↑' : '↓'}`)
  if (filter.limit !== undefined) parts.push(`Первые ${filter.limit}`)
  return parts
}
