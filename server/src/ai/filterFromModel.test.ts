import { describe, expect, it } from 'vitest'
import { filterFromModelOutput } from './filterFromModel.ts'

const empty = { nameContains: null, ancestorName: null, levels: null, metrics: null, sort: null, limit: null }

describe('filterFromModelOutput', () => {
  it('null, пустые строки и массивы — «условия нет»; повторы уровней схлопываются', () => {
    expect(filterFromModelOutput(JSON.stringify(empty))).toEqual({ ok: true, filter: {} })
    expect(
      filterFromModelOutput(
        JSON.stringify({ ...empty, nameContains: ' альфа ', levels: [2, 2, 3], metrics: [], sort: { key: 'totalBudget', dir: 'desc' }, limit: 5 }),
      ),
    ).toEqual({
      ok: true,
      filter: { nameContains: 'альфа', levels: [2, 3], sort: { key: 'totalBudget', dir: 'desc' }, limit: 5 },
    })
  })

  it('отклоняет не-JSON, лишние поля и значения вне контракта', () => {
    expect(filterFromModelOutput('not json').ok).toBe(false)
    expect(filterFromModelOutput('[1]').ok).toBe(false)
    expect(filterFromModelOutput(JSON.stringify({ ...empty, dropTables: true })).ok).toBe(false)
    expect(filterFromModelOutput(JSON.stringify({ ...empty, levels: [4] })).ok).toBe(false)
    expect(filterFromModelOutput(JSON.stringify({ ...empty, limit: 0 })).ok).toBe(false)
    expect(filterFromModelOutput(JSON.stringify({ ...empty, nameContains: 'x'.repeat(101) })).ok).toBe(false)
    expect(
      filterFromModelOutput(JSON.stringify({ ...empty, metrics: [{ field: 'performance', op: 'gte', value: 101 }] })).ok,
    ).toBe(false)
    expect(
      filterFromModelOutput(
        JSON.stringify({ ...empty, metrics: Array.from({ length: 6 }, () => ({ field: 'budget', op: 'gt', value: 1 })) }),
      ).ok,
    ).toBe(false)
  })
})
