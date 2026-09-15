import { describe, expect, it } from 'vitest'
import { parseServerMessage } from './protocol.ts'

const at = '2026-09-15T10:00:00.000Z'

describe('parseServerMessage', () => {
  it('принимает сообщения протокола', () => {
    expect(parseServerMessage(JSON.stringify({ type: 'hello', epoch: 'e1', revision: 0 }))).toEqual({
      type: 'hello',
      epoch: 'e1',
      revision: 0,
    })
    const patch = { type: 'patch', epoch: 'e1', revision: 3, changes: [{ id: 'a', headcount: 5, updatedAt: at }] }
    expect(parseServerMessage(JSON.stringify(patch))).toEqual(patch)
  })

  it('отклоняет не-JSON, бинарные данные, неизвестный тип и значения вне контракта', () => {
    expect(parseServerMessage('{oops')).toBeNull()
    expect(parseServerMessage(new ArrayBuffer(4))).toBeNull()
    expect(parseServerMessage(JSON.stringify({ type: 'bye', epoch: 'e1', revision: 1 }))).toBeNull()
    expect(
      parseServerMessage(
        JSON.stringify({ type: 'patch', epoch: 'e1', revision: 1, changes: [{ id: 'a', performance: 101, updatedAt: at }] }),
      ),
    ).toBeNull()
    expect(parseServerMessage(JSON.stringify({ type: 'patch', epoch: 'e1', revision: 1, changes: [] }))).toBeNull()
  })
})
