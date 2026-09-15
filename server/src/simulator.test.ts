import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRandom, generateOrgTree } from './data/generate.ts'
import { proposeUpdates, startSimulator } from './simulator.ts'
import { OrgStore } from './store.ts'

afterEach(() => {
  vi.useRealTimers()
})

describe('proposeUpdates', () => {
  it('меняет 1–3 разных узла, значения остаются в допустимых диапазонах', () => {
    const random = createRandom(7)
    const nodes = generateOrgTree()
    const byId = new Map(nodes.map((node) => [node.id, node]))

    for (let i = 0; i < 500; i += 1) {
      const updates = proposeUpdates(nodes, random)
      expect(updates.length).toBeGreaterThanOrEqual(1)
      expect(updates.length).toBeLessThanOrEqual(3)
      expect(new Set(updates.map((update) => update.id)).size).toBe(updates.length)

      for (const update of updates) {
        const original = byId.get(update.id)!
        expect(Object.keys(update).length).toBeGreaterThan(1)
        if (update.headcount !== undefined) {
          expect(update.headcount).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(update.headcount)).toBe(true)
        }
        if (update.budget !== undefined) {
          expect(Math.abs(update.budget - original.budget)).toBeLessThanOrEqual(original.budget * 0.05 + 1)
        }
        if (update.performance !== undefined) {
          expect(update.performance).toBeGreaterThanOrEqual(0)
          expect(update.performance).toBeLessThanOrEqual(100)
        }
      }
    }
  })
})

describe('startSimulator', () => {
  it('изменяет хранилище с интервалом из диапазона и останавливается', () => {
    vi.useFakeTimers()
    const store = new OrgStore()
    const stop = startSimulator(store, { minIntervalMs: 1000, maxIntervalMs: 1000, random: createRandom(1) })

    vi.advanceTimersByTime(999)
    expect(store.revision).toBe(0)
    vi.advanceTimersByTime(5000)
    const revision = store.revision
    expect(revision).toBeGreaterThan(0)

    stop()
    vi.advanceTimersByTime(10_000)
    expect(store.revision).toBe(revision)
  })
})
