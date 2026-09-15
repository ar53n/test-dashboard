import { getChildren } from '@/entities/org/model/buildIndex.ts'
import { getLevel } from '@/entities/org/model/level.ts'
import type { OrgModel } from '@/entities/org/model/orgModel.ts'

export interface OrgTableRow {
  readonly id: string
  readonly name: string
  readonly level: number
  readonly totalHeadcount: number
  readonly totalBudget: number
  readonly avgPerformance: number | null
  /** Нормализованное название для поиска, считается один раз при построении строк. */
  readonly searchKey: string
}

export type SortKey = 'name' | 'level' | 'totalHeadcount' | 'totalBudget' | 'avgPerformance'
export type SortDirection = 'asc' | 'desc'
export interface SortState {
  readonly key: SortKey
  readonly direction: SortDirection
}

/**
 * Строки таблицы в порядке дерева (обход в глубину), чтобы без сортировки
 * таблица читалась так же, как дерево. Агрегаты берутся из модели, а не считаются заново.
 */
export function buildRows(model: OrgModel): OrgTableRow[] {
  const rows: OrgTableRow[] = []
  const stack = [...model.roots].reverse()
  while (stack.length > 0) {
    const id = stack.pop()!
    const node = model.nodes.get(id)!
    const aggregate = model.aggregates.get(id)!
    rows.push({
      id,
      name: node.name,
      level: getLevel(model.depth.get(id)!),
      totalHeadcount: aggregate.totalHeadcount,
      totalBudget: aggregate.totalBudget,
      avgPerformance: aggregate.avgPerformance,
      searchKey: normalizeSearch(node.name),
    })
    const children = getChildren(model, id)
    for (let i = children.length - 1; i >= 0; i -= 1) stack.push(children[i])
  }
  return rows
}

const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true })

function compareByKey(a: OrgTableRow, b: OrgTableRow, key: Exclude<SortKey, 'avgPerformance'>): number {
  return key === 'name' ? collator.compare(a.name, b.name) : a[key] - b[key]
}

/**
 * Стабильная сортировка: при равных значениях сохраняется порядок дерева.
 * Узлы без сотрудников (`avgPerformance === null`) всегда в конце, в обоих направлениях.
 */
export function sortRows(rows: readonly OrgTableRow[], sort: SortState | null): readonly OrgTableRow[] {
  if (!sort) return rows
  const sign = sort.direction === 'asc' ? 1 : -1

  return [...rows].sort((a, b) => {
    if (sort.key === 'avgPerformance') {
      if (a.avgPerformance === null || b.avgPerformance === null) {
        return Number(a.avgPerformance === null) - Number(b.avgPerformance === null)
      }
      return sign * (a.avgPerformance - b.avgPerformance)
    }
    return sign * compareByKey(a, b, sort.key)
  })
}

/** Регистр, «ё» и повторяющиеся пробелы не влияют на поиск. */
export function normalizeSearch(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replaceAll('ё', 'е')
}

export function filterRows(rows: readonly OrgTableRow[], query: string): readonly OrgTableRow[] {
  const needle = normalizeSearch(query)
  if (!needle) return rows
  return rows.filter((row) => row.searchKey.includes(needle))
}
