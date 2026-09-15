import { describe, expect, it } from 'vitest'
import { generateOrgTree } from './generate.ts'

describe('generateOrgTree', () => {
  const nodes = generateOrgTree()
  const byId = new Map(nodes.map((node) => [node.id, node]))

  const depthOf = (id: string): number => {
    const parentId = byId.get(id)!.parentId
    return parentId === null ? 0 : depthOf(parentId) + 1
  }

  it('не меньше 40 узлов и три уровня вложенности', () => {
    expect(nodes.length).toBeGreaterThanOrEqual(40)
    expect(Math.max(...nodes.map((node) => depthOf(node.id)))).toBeGreaterThanOrEqual(2)
  })

  it('уникальные id и существующие родители', () => {
    expect(byId.size).toBe(nodes.length)
    for (const node of nodes) {
      if (node.parentId !== null) expect(byId.has(node.parentId)).toBe(true)
    }
  })

  it('метрики в допустимых пределах', () => {
    for (const node of nodes) {
      expect(node.performance).toBeGreaterThanOrEqual(0)
      expect(node.performance).toBeLessThanOrEqual(100)
      expect(Number.isInteger(node.headcount)).toBe(true)
      expect(node.budget).toBeGreaterThanOrEqual(0)
      expect(new Date(node.updatedAt).toISOString()).toBe(node.updatedAt)
    }
  })

  it('детерминирован для одного seed', () => {
    expect(generateOrgTree(7)).toEqual(generateOrgTree(7))
  })
})
