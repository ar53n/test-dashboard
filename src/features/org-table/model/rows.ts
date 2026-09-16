import type { FilterSortKey, OrgFilter } from '@shared/orgFilter.ts'
import type { Aggregate } from '@/entities/org/model/aggregate.ts'
import { getChildren } from '@/entities/org/model/buildIndex.ts'
import { getLevel } from '@/entities/org/model/level.ts'
import type { OrgModel } from '@/entities/org/model/orgModel.ts'

/** Строка таблицы показывает агрегаты узла как есть; служебный `perfWeightSum` ей не нужен. */
export interface OrgTableRow extends Pick<Aggregate, 'totalHeadcount' | 'totalBudget' | 'avgPerformance'> {
  readonly id: string
  readonly name: string
  readonly level: number
  /** Нормализованное название для поиска, считается один раз при построении строк. */
  readonly searchKey: string
}

/**
 * Ключи и направления сортировки берутся из контракта AI-фильтра: таблица применяет его сортировку.
 * В состоянии таблицы направление называется `direction`, в API — `dir` (см. `filterSort`).
 */
export type SortKey = FilterSortKey
export type SortDirection = NonNullable<OrgFilter['sort']>['dir']
export interface SortState {
  readonly key: SortKey
  readonly direction: SortDirection
}

/**
 * Строки таблицы в порядке дерева (обход в глубину), чтобы без сортировки
 * таблица читалась так же, как дерево. Агрегаты берутся из модели, а не считаются заново.
 *
 * `previous` — строки прошлой версии модели: строка, у которой не изменились имя, уровень
 * и агрегат (ссылка), переиспользуется. После патча новые объекты получают только
 * изменённый узел и его предки, и `memo` остальных строк пропускает ререндер.
 */
export function buildRows(model: OrgModel, previous?: ReadonlyMap<string, OrgTableRow>): OrgTableRow[] {
  const rows: OrgTableRow[] = []
  const stack = [...model.roots].reverse()
  while (stack.length > 0) {
    const id = stack.pop()!
    const node = model.nodes.get(id)!
    const aggregate = model.aggregates.get(id)!
    const level = getLevel(model.depth.get(id)!)
    const reusable = previous?.get(id)
    const unchanged =
      reusable &&
      reusable.name === node.name &&
      reusable.level === level &&
      reusable.totalHeadcount === aggregate.totalHeadcount &&
      reusable.totalBudget === aggregate.totalBudget &&
      reusable.avgPerformance === aggregate.avgPerformance

    rows.push(
      unchanged
        ? reusable
        : {
            id,
            name: node.name,
            level,
            totalHeadcount: aggregate.totalHeadcount,
            totalBudget: aggregate.totalBudget,
            avgPerformance: aggregate.avgPerformance,
            searchKey: normalizeSearch(node.name),
          },
    )
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
