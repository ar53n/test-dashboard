import { describe, expect, it, vi } from 'vitest'
import type { OrgNode } from '../../shared/contract.ts'
import { OrgStore } from './store.ts'

const node = (id: string, overrides: Partial<OrgNode> = {}): OrgNode => ({
  id,
  name: `Узел ${id}`,
  parentId: null,
  headcount: 10,
  budget: 1_000_000,
  performance: 50,
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
})

const now = new Date('2026-09-15T10:00:00.000Z')

describe('OrgStore.update', () => {
  it('в патч попадают только изменившиеся поля, ревизия растёт на 1', () => {
    const store = new OrgStore([node('a'), node('b')])
    const listener = vi.fn()
    store.subscribe(listener)

    const patch = store.update([{ id: 'a', headcount: 12, budget: 1_000_000, performance: 50 }], now)

    expect(patch).toEqual({
      type: 'patch',
      epoch: store.epoch,
      revision: 1,
      changes: [{ id: 'a', headcount: 12, updatedAt: now.toISOString() }],
    })
    expect(store.revision).toBe(1)
    expect(store.snapshot()[0]).toMatchObject({ headcount: 12, updatedAt: now.toISOString() })
    expect(listener).toHaveBeenCalledWith(patch)
  })

  it('если ничего не изменилось — ни ревизии, ни updatedAt, ни рассылки', () => {
    const store = new OrgStore([node('a')])
    const listener = vi.fn()
    store.subscribe(listener)
    const before = store.snapshot()

    expect(store.update([{ id: 'a', headcount: 10, performance: 50 }], now)).toBeNull()
    expect(store.revision).toBe(0)
    expect(store.snapshot()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
  })

  it('несколько изменений одного узла в пакете сливаются в одно', () => {
    const store = new OrgStore([node('a')])
    const patch = store.update([{ id: 'a', headcount: 11 }, { id: 'a', performance: 70 }], now)
    expect(patch!.changes).toEqual([{ id: 'a', headcount: 11, performance: 70, updatedAt: now.toISOString() }])
  })

  it('не мутирует ранее выданный снимок', () => {
    const store = new OrgStore([node('a')])
    const before = store.snapshot()
    store.update([{ id: 'a', headcount: 99 }], now)
    expect(before[0].headcount).toBe(10)
  })

  it('неизвестный узел — ошибка', () => {
    const store = new OrgStore([node('a')])
    expect(() => store.update([{ id: 'ghost', headcount: 1 }])).toThrow()
  })
})
