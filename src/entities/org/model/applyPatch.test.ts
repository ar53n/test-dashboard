import type { NodeChange, OrgNode, PatchMessage } from '@shared/contract.ts'
import { describe, expect, it, vi } from 'vitest'
import * as aggregateModule from './aggregate.ts'
import { computeAggregates } from './aggregate.ts'
import { applyPatch, PatchConflictError } from './applyPatch.ts'
import { createOrgModel, type OrgModel } from './orgModel.ts'
import { makeNode } from './testUtils.ts'

const version = { epoch: 'e1', revision: 0 }
const patch = (revision: number, changes: NodeChange[]): PatchMessage => ({ type: 'patch', epoch: 'e1', revision, changes })
const at = '2026-09-15T10:00:00.000Z'

/** Дерево глубины 4 с разветвлением. */
function makeModel(): OrgModel {
  return createOrgModel(
    [
      makeNode('div-1', null, { headcount: 3, budget: 9_000_000, performance: 80 }),
      makeNode('div-2', null, { headcount: 2, budget: 4_000_000, performance: 60 }),
      makeNode('dep-1', 'div-1', { headcount: 1, budget: 2_000_000, performance: 70 }),
      makeNode('dep-2', 'div-1', { headcount: 2, budget: 3_000_000, performance: 55 }),
      makeNode('dep-3', 'div-2', { headcount: 4, budget: 1_500_000, performance: 90 }),
      makeNode('team-1', 'dep-1', { headcount: 12, budget: 1_200_000, performance: 65 }),
      makeNode('team-2', 'dep-1', { headcount: 8, budget: 800_000, performance: 88 }),
      makeNode('team-3', 'dep-2', { headcount: 15, budget: 2_100_000, performance: 42 }),
      makeNode('group-1', 'team-1', { headcount: 5, budget: 300_000, performance: 99 }),
    ],
    version,
  )
}

/** Сравнивает агрегаты с полной агрегацией по тем же узлам (с допуском на float). */
function expectMatchesFullAggregation(model: OrgModel) {
  const full = computeAggregates(model)
  for (const [id, expected] of full) {
    const actual = model.aggregates.get(id)!
    expect(actual.totalHeadcount, id).toBe(expected.totalHeadcount)
    expect(actual.totalBudget, id).toBeCloseTo(expected.totalBudget, 6)
    expect(actual.perfWeightSum, id).toBeCloseTo(expected.perfWeightSum, 6)
    if (expected.avgPerformance === null) expect(actual.avgPerformance, id).toBeNull()
    else expect(actual.avgPerformance!, id).toBeCloseTo(expected.avgPerformance, 9)
  }
}

describe('applyPatch', () => {
  it('на серии случайных пакетов совпадает с полной агрегацией', () => {
    let seed = 12345
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      return seed / 2 ** 31
    }
    let model = makeModel()
    const ids = [...model.nodes.keys()]

    for (let revision = 1; revision <= 300; revision += 1) {
      const changes: NodeChange[] = Array.from({ length: 1 + Math.floor(random() * 3) }, () => {
        const change: NodeChange = { id: ids[Math.floor(random() * ids.length)], updatedAt: at }
        if (random() < 0.6) change.headcount = Math.floor(random() * 20)
        if (random() < 0.6) change.budget = Math.round(random() * 5_000_000 * 100) / 100
        if (random() < 0.6) change.performance = Math.round(random() * 1000) / 10
        return change
      })
      model = applyPatch(model, patch(revision, changes))
    }

    expectMatchesFullAggregation(model)
    expect(model.version).toEqual({ epoch: 'e1', revision: 300 })
  })

  it('пересчитывает только изменённый узел и его предков, остальные ссылки сохраняются', () => {
    const model = makeModel()
    const spy = vi.spyOn(aggregateModule, 'aggregateNode')
    const next = applyPatch(model, patch(1, [{ id: 'group-1', headcount: 10, updatedAt: at }]))

    expect(spy.mock.calls.map(([node]) => node.id)).toEqual(['group-1', 'team-1', 'dep-1', 'div-1'])
    spy.mockRestore()

    for (const id of ['team-2', 'dep-2', 'team-3', 'div-2', 'dep-3']) {
      expect(next.aggregates.get(id), id).toBe(model.aggregates.get(id))
      expect(next.nodes.get(id), id).toBe(model.nodes.get(id))
    }
    expect(next.aggregates.get('div-1')!.totalHeadcount).toBe(model.aggregates.get('div-1')!.totalHeadcount + 5)
    expect(next.children).toBe(model.children)
    expectMatchesFullAggregation(next)
  })

  it('пакет с предком и потомком даёт тот же результат, что полная агрегация; общий предок считается один раз', () => {
    const model = makeModel()
    const spy = vi.spyOn(aggregateModule, 'aggregateNode')
    const next = applyPatch(
      model,
      patch(1, [
        { id: 'div-1', budget: 1, updatedAt: at },
        { id: 'group-1', performance: 10, updatedAt: at },
        { id: 'team-3', headcount: 0, updatedAt: at },
      ]),
    )
    const counted = spy.mock.calls.map(([node]) => node.id)
    spy.mockRestore()

    expect(new Set(counted).size).toBe(counted.length)
    expect(counted.at(-1)).toBe('div-1')
    expectMatchesFullAggregation(next)
  })

  it('изменение только имени или updatedAt не пересчитывает агрегаты', () => {
    const model = makeModel()
    const next = applyPatch(model, patch(1, [{ id: 'team-2', name: 'Новое имя', updatedAt: at }]))

    expect(next.aggregates).toBe(model.aggregates)
    expect(next.nodes.get('team-2')).toMatchObject<Partial<OrgNode>>({ name: 'Новое имя', updatedAt: at })
    expect(next.version).toEqual({ epoch: 'e1', revision: 1 })
  })

  it('численно равный агрегат сохраняет прежнюю ссылку', () => {
    const model = makeModel()
    // Бюджет двух команд меняется на одну сумму в разные стороны: суммы отдела и дивизиона не меняются.
    const next = applyPatch(
      model,
      patch(1, [
        { id: 'team-1', budget: 1_300_000, updatedAt: at },
        { id: 'team-2', budget: 700_000, updatedAt: at },
      ]),
    )
    expect(next.aggregates.get('team-1')).not.toBe(model.aggregates.get('team-1'))
    expect(next.aggregates.get('dep-1')).toBe(model.aggregates.get('dep-1'))
    expect(next.aggregates.get('div-1')).toBe(model.aggregates.get('div-1'))
  })

  it('не мутирует исходную модель', () => {
    const model = makeModel()
    const nodesBefore = new Map(model.nodes)
    const aggregatesBefore = new Map(model.aggregates)
    applyPatch(model, patch(1, [{ id: 'team-1', headcount: 1, updatedAt: at }]))
    expect(model.nodes).toEqual(nodesBefore)
    expect(model.aggregates).toEqual(aggregatesBefore)
    expect(model.version).toEqual(version)
  })

  it('неизвестный узел — конфликт', () => {
    expect(() => applyPatch(makeModel(), patch(1, [{ id: 'ghost', headcount: 1, updatedAt: at }]))).toThrow(
      PatchConflictError,
    )
  })
})
