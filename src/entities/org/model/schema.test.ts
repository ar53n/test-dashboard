import { describe, expect, it } from 'vitest'
import { formatIssues, orgTreeResponseSchema } from './schema.ts'
import { makeNode } from './testUtils.ts'

describe('orgTreeResponseSchema', () => {
  it('принимает корректный массив и пустой массив', () => {
    expect(orgTreeResponseSchema.safeParse([makeNode('a', null), makeNode('b', 'a')]).success).toBe(true)
    expect(orgTreeResponseSchema.safeParse([]).success).toBe(true)
  })

  it.each([
    ['не массив', { nodes: [] }],
    ['performance > 100', [makeNode('a', null, { performance: 101 })]],
    ['отрицательный headcount', [makeNode('a', null, { headcount: -1 })]],
    ['дробный headcount', [makeNode('a', null, { headcount: 1.5 })]],
    ['budget строкой', [{ ...makeNode('a', null), budget: '100' }]],
    ['нет parentId', [{ ...makeNode('a', null), parentId: undefined }]],
    ['updatedAt не ISO', [makeNode('a', null, { updatedAt: 'вчера' })]],
  ])('отклоняет: %s', (_, payload) => {
    const result = orgTreeResponseSchema.safeParse(payload)
    expect(result.success).toBe(false)
    if (!result.success) expect(formatIssues(result.error).length).toBeGreaterThan(0)
  })
})
