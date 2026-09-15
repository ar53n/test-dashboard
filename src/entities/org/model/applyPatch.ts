import type { MutableNodeField, OrgNode, PatchMessage } from '@shared/contract.ts'
import { aggregateNode, type Aggregate } from './aggregate.ts'
import { getChildren } from './buildIndex.ts'
import type { OrgModel } from './orgModel.ts'

/** Патч не согласуется с моделью (например, неизвестный узел) — нужна повторная синхронизация. */
export class PatchConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PatchConflictError'
  }
}

const METRIC_FIELDS = ['headcount', 'budget', 'performance'] as const satisfies readonly MutableNodeField[]

const sameAggregate = (a: Aggregate, b: Aggregate) =>
  a.totalHeadcount === b.totalHeadcount &&
  a.totalBudget === b.totalBudget &&
  a.perfWeightSum === b.perfWeightSum &&
  a.avgPerformance === b.avgPerformance

/**
 * Применяет пакет изменений к модели без полной агрегации.
 *
 * 1. Применяет к узлам все изменения пакета.
 * 2. Собирает множество узлов с изменившимися метриками вместе с их предками.
 * 3. Пересчитывает это множество снизу вверх (по убыванию глубины): агрегат узла
 *    = собственные значения + агрегаты детей, поэтому ошибка округления не накапливается.
 *
 * Copy-on-write: неизменённые узлы и агрегаты сохраняют ссылки; агрегат, численно
 * равный прежнему, тоже остаётся прежним объектом. Структура дерева не меняется.
 */
export function applyPatch(model: OrgModel, patch: PatchMessage): OrgModel {
  const nodes = new Map(model.nodes)
  const dirty = new Set<string>()

  for (const change of patch.changes) {
    const current = nodes.get(change.id)
    if (!current) throw new PatchConflictError(`Патч ссылается на неизвестный узел «${change.id}»`)

    const next: OrgNode = { ...current, ...change }
    nodes.set(change.id, next)
    if (METRIC_FIELDS.some((field) => next[field] !== current[field])) dirty.add(change.id)
  }

  let aggregates = model.aggregates
  if (dirty.size > 0) {
    // Предки каждого изменённого узла; общие предки попадают в множество один раз.
    for (const id of [...dirty]) {
      let parentId = nodes.get(id)!.parentId
      while (parentId !== null && !dirty.has(parentId)) {
        dirty.add(parentId)
        parentId = nodes.get(parentId)!.parentId
      }
    }

    const nextAggregates = new Map(model.aggregates)
    const order = [...dirty].sort((a, b) => model.depth.get(b)! - model.depth.get(a)!)
    for (const id of order) {
      const childAggregates = getChildren(model, id).map((childId) => nextAggregates.get(childId)!)
      const recomputed = aggregateNode(nodes.get(id)!, childAggregates)
      const previous = model.aggregates.get(id)!
      nextAggregates.set(id, sameAggregate(recomputed, previous) ? previous : recomputed)
    }
    aggregates = nextAggregates
  }

  return {
    ...model,
    nodes,
    aggregates,
    version: { epoch: patch.epoch, revision: patch.revision },
  }
}
