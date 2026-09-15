import { describe, expect, it } from 'vitest'
import { computeAggregates } from './aggregate.ts'
import { buildIndex } from './buildIndex.ts'
import { makeNode } from './testUtils.ts'

describe('computeAggregates', () => {
  const index = buildIndex([
    makeNode('div', null, { headcount: 2, budget: 5_000_000, performance: 90 }),
    makeNode('dep', 'div', { headcount: 1, budget: 2_000_000, performance: 60 }),
    makeNode('team-a', 'dep', { headcount: 10, budget: 1_000_000, performance: 80 }),
    makeNode('team-b', 'dep', { headcount: 30, budget: 3_000_000, performance: 40 }),
    makeNode('group', 'team-b', { headcount: 7, budget: 500_000, performance: 100 }),
  ])
  const aggregates = computeAggregates(index)

  it('лист: собственные значения', () => {
    expect(aggregates.get('group')).toEqual({
      totalHeadcount: 7,
      totalBudget: 500_000,
      perfWeightSum: 700,
      avgPerformance: 100,
    })
  })

  it('суммирует численность и бюджет узла и всех потомков на любой глубине', () => {
    expect(aggregates.get('team-b')!.totalHeadcount).toBe(37)
    expect(aggregates.get('dep')!.totalHeadcount).toBe(48)
    expect(aggregates.get('div')!.totalHeadcount).toBe(50)
    expect(aggregates.get('div')!.totalBudget).toBe(11_500_000)
  })

  it('среднюю эффективность взвешивает по headcount, а не по количеству узлов', () => {
    // (1·60 + 10·80 + 30·40 + 7·100) / 48
    expect(aggregates.get('dep')!.avgPerformance).toBeCloseTo((60 + 800 + 1200 + 700) / 48, 10)
    // простое среднее по узлам дало бы (60 + 80 + 40 + 100) / 4 = 70
    expect(aggregates.get('dep')!.avgPerformance).not.toBeCloseTo(70, 1)
  })

  it('возвращает null для поддерева без сотрудников и не учитывает узлы с нулевым headcount', () => {
    const empty = computeAggregates(
      buildIndex([
        makeNode('root', null, { headcount: 0, performance: 10 }),
        makeNode('child', 'root', { headcount: 0, performance: 99 }),
      ]),
    )
    expect(empty.get('root')!.avgPerformance).toBeNull()

    const mixed = computeAggregates(
      buildIndex([
        makeNode('root', null, { headcount: 0, performance: 0 }),
        makeNode('child', 'root', { headcount: 5, performance: 70 }),
      ]),
    )
    expect(mixed.get('root')!.avgPerformance).toBe(70)
  })

  it('считает агрегат для каждого узла', () => {
    expect(aggregates.size).toBe(index.nodes.size)
  })
})
