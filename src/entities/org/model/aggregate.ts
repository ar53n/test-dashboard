import type { OrgNode } from '@shared/contract.ts'
import { getChildren, type OrgIndex } from './buildIndex.ts'

export interface Aggregate {
  /** Сотрудники узла и всех потомков. */
  readonly totalHeadcount: number
  /** Бюджет узла и всех потомков. */
  readonly totalBudget: number
  /** Σ performance × headcount — хранится, чтобы предки считали взвешенное среднее без обхода поддерева. */
  readonly perfWeightSum: number
  /** Средняя эффективность, взвешенная по headcount; `null`, если в поддереве нет сотрудников. */
  readonly avgPerformance: number | null
}

/** Агрегат узла из его собственных значений и уже посчитанных агрегатов детей. */
export function aggregateNode(node: OrgNode, childAggregates: Iterable<Aggregate>): Aggregate {
  let totalHeadcount = node.headcount
  let totalBudget = node.budget
  let perfWeightSum = node.performance * node.headcount

  for (const child of childAggregates) {
    totalHeadcount += child.totalHeadcount
    totalBudget += child.totalBudget
    perfWeightSum += child.perfWeightSum
  }

  return {
    totalHeadcount,
    totalBudget,
    perfWeightSum,
    avgPerformance: totalHeadcount > 0 ? perfWeightSum / totalHeadcount : null,
  }
}

/** Полная агрегация за O(n): обход снизу вверх, без рекурсии. */
export function computeAggregates(index: OrgIndex): ReadonlyMap<string, Aggregate> {
  const aggregates = new Map<string, Aggregate>()

  for (let i = index.topDownOrder.length - 1; i >= 0; i -= 1) {
    const id = index.topDownOrder[i]
    const childAggregates = getChildren(index, id).map((childId) => aggregates.get(childId)!)
    aggregates.set(id, aggregateNode(index.nodes.get(id)!, childAggregates))
  }

  return aggregates
}
