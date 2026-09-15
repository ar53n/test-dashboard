import { describe, expect, it } from 'vitest'
import { createOrgModel } from '@/entities/org/model/orgModel.ts'
import { makeNode } from '@/entities/org/model/testUtils.ts'
import { applyOrgFilter, filterSort, isEmptyFilter, matchesOrgFilter } from './applyOrgFilter.ts'
import { buildRows, sortRows } from './rows.ts'

const model = createOrgModel(
  [
    makeNode('sales', null, { name: 'Продажи', headcount: 2, budget: 3_000_000, performance: 80 }),
    makeNode('b2b', 'sales', { name: 'Корпоративные клиенты', headcount: 1, budget: 1_000_000, performance: 70 }),
    makeNode('b2b-alpha', 'b2b', { name: 'Корпоративные клиенты: команда «Альфа»', headcount: 12, budget: 2_500_000, performance: 90 }),
    makeNode('b2b-beta', 'b2b', { name: 'Корпоративные клиенты: команда «Бета»', headcount: 5, budget: 800_000, performance: 40 }),
    makeNode('tech', null, { name: 'Технологии', headcount: 3, budget: 5_000_000, performance: 60 }),
    makeNode('platform', 'tech', { name: 'Платформа', headcount: 0, budget: 100_000, performance: 0 }),
  ],
  null,
)
const rows = buildRows(model)
const ids = (list: readonly { id: string }[]) => list.map((row) => row.id)

describe('applyOrgFilter', () => {
  it('уровень и предок: «команды в Продажах» (подстрока имени любого предка, без учёта регистра и ё)', () => {
    expect(ids(applyOrgFilter(rows, model, { levels: [3], ancestorName: 'ПРОДАЖ' }))).toEqual(['b2b-alpha', 'b2b-beta'])
    expect(ids(applyOrgFilter(rows, model, { ancestorName: 'корпоративн' }))).toEqual(['b2b-alpha', 'b2b-beta'])
    // Сам узел не считается своим предком.
    expect(ids(applyOrgFilter(rows, model, { ancestorName: 'Технологии' }))).toEqual(['platform'])
  })

  it('суммарные и собственные метрики различаются', () => {
    // Суммарный бюджет «Корпоративных клиентов» 4,3 млн, собственный — 1 млн.
    expect(ids(applyOrgFilter(rows, model, { levels: [2], metrics: [{ field: 'totalBudget', op: 'gt', value: 4_000_000 }] }))).toEqual(['b2b'])
    expect(ids(applyOrgFilter(rows, model, { levels: [2], metrics: [{ field: 'budget', op: 'gt', value: 4_000_000 }] }))).toEqual([])
    expect(ids(applyOrgFilter(rows, model, { metrics: [{ field: 'headcount', op: 'gte', value: 12 }] }))).toEqual(['b2b-alpha'])
  })

  it('все операции сравнения и несколько условий одновременно (И)', () => {
    const perf = (op: 'gt' | 'gte' | 'lt' | 'lte', value: number) =>
      ids(applyOrgFilter(rows, model, { levels: [3], metrics: [{ field: 'performance', op, value }] }))
    expect(perf('gt', 40)).toEqual(['b2b-alpha'])
    expect(perf('gte', 40)).toEqual(['b2b-alpha', 'b2b-beta'])
    expect(perf('lt', 90)).toEqual(['b2b-beta'])
    expect(perf('lte', 90)).toEqual(['b2b-alpha', 'b2b-beta'])
    expect(
      ids(
        applyOrgFilter(rows, model, {
          metrics: [
            { field: 'totalHeadcount', op: 'gte', value: 5 },
            { field: 'avgPerformance', op: 'lt', value: 75 },
          ],
        }),
      ),
    ).toEqual(['b2b-beta'])
  })

  it('неопределённая эффективность (нет сотрудников) не проходит ни одно условие', () => {
    const platform = rows.find((row) => row.id === 'platform')!
    expect(platform.avgPerformance).toBeNull()
    expect(matchesOrgFilter(platform, model, { metrics: [{ field: 'avgPerformance', op: 'lte', value: 100 }] })).toBe(false)
    expect(matchesOrgFilter(platform, model, { metrics: [{ field: 'avgPerformance', op: 'gte', value: 0 }] })).toBe(false)
  })

  it('лимит берётся после сортировки: «топ-2 по бюджету»', () => {
    const filter = { sort: { key: 'totalBudget', dir: 'desc' }, limit: 2 } as const
    const sorted = sortRows(rows, filterSort(filter))
    expect(ids(applyOrgFilter(sorted, model, filter))).toEqual(['sales', 'tech'])
  })

  it('название содержит подстроку', () => {
    expect(ids(applyOrgFilter(rows, model, { nameContains: 'альфа' }))).toEqual(['b2b-alpha'])
  })

  it('isEmptyFilter и filterSort', () => {
    expect(isEmptyFilter({})).toBe(true)
    expect(isEmptyFilter({ limit: 1 })).toBe(false)
    expect(filterSort({})).toBeNull()
    expect(filterSort({ sort: { key: 'name', dir: 'asc' } })).toEqual({ key: 'name', direction: 'asc' })
  })
})
