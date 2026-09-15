import type { MetricCondition, OrgFilter } from '@shared/orgFilter.ts'
import type { OrgModel } from '@/entities/org/model/orgModel.ts'
import { normalizeSearch, type OrgTableRow, type SortState } from './rows.ts'

function metricValue(row: OrgTableRow, model: OrgModel, field: MetricCondition['field']): number | null {
  switch (field) {
    case 'totalHeadcount':
    case 'totalBudget':
    case 'avgPerformance':
      return row[field]
    default:
      return model.nodes.get(row.id)?.[field] ?? null
  }
}

function compare(value: number, { op, value: threshold }: MetricCondition): boolean {
  switch (op) {
    case 'gt':
      return value > threshold
    case 'gte':
      return value >= threshold
    case 'lt':
      return value < threshold
    case 'lte':
      return value <= threshold
  }
}

function hasAncestorNamed(model: OrgModel, id: string, needle: string): boolean {
  let parentId = model.nodes.get(id)?.parentId ?? null
  while (parentId !== null) {
    const parent = model.nodes.get(parentId)
    if (!parent) return false
    if (normalizeSearch(parent.name).includes(needle)) return true
    parentId = parent.parentId
  }
  return false
}

export function matchesOrgFilter(row: OrgTableRow, model: OrgModel, filter: OrgFilter): boolean {
  if (filter.nameContains && !row.searchKey.includes(normalizeSearch(filter.nameContains))) return false
  if (filter.levels && !filter.levels.includes(row.level as 1 | 2 | 3)) return false
  if (filter.ancestorName && !hasAncestorNamed(model, row.id, normalizeSearch(filter.ancestorName))) return false
  for (const condition of filter.metrics ?? []) {
    const value = metricValue(row, model, condition.field)
    // Неопределённая эффективность (нет сотрудников) не проходит ни одно условие.
    if (value === null || !compare(value, condition)) return false
  }
  return true
}

/** Фильтр и лимит поверх уже отсортированных строк: «топ-N» берётся после сортировки. */
export function applyOrgFilter(rows: readonly OrgTableRow[], model: OrgModel, filter: OrgFilter): readonly OrgTableRow[] {
  const matched = rows.filter((row) => matchesOrgFilter(row, model, filter))
  return filter.limit === undefined ? matched : matched.slice(0, filter.limit)
}

export function filterSort(filter: OrgFilter): SortState | null {
  return filter.sort ? { key: filter.sort.key, direction: filter.sort.dir } : null
}

export function isEmptyFilter(filter: OrgFilter): boolean {
  return Object.keys(filter).length === 0
}
