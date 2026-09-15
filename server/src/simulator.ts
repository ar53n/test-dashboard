import type { OrgNode } from '../../shared/contract.ts'
import type { NodeUpdate, OrgStore } from './store.ts'

export interface SimulatorOptions {
  minIntervalMs: number
  maxIntervalMs: number
  random?: () => number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Случайные изменения 1–3 узлов: численность ±1–2, бюджет ±5%, эффективность ±5.
 * Значения ограничиваются допустимыми диапазонами, поэтому часть предложений может
 * ничего не изменить — такие поля отбросит хранилище.
 */
export function proposeUpdates(nodes: readonly OrgNode[], random: () => number): NodeUpdate[] {
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))
  const sign = () => (random() < 0.5 ? -1 : 1)
  const count = Math.min(nodes.length, int(1, 3))
  const picked = new Set<number>()
  while (picked.size < count) picked.add(int(0, nodes.length - 1))

  return [...picked].map((index) => {
    const node = nodes[index]
    const update: NodeUpdate = { id: node.id }
    // Хотя бы одна метрика меняется всегда, остальные — с вероятностью 1/2.
    const forced = int(0, 2)
    if (forced === 0 || random() < 0.5) update.headcount = Math.max(0, node.headcount + sign() * int(1, 2))
    if (forced === 1 || random() < 0.5) update.budget = Math.max(0, Math.round(node.budget * (1 + sign() * random() * 0.05)))
    if (forced === 2 || random() < 0.5) update.performance = clamp(node.performance + sign() * int(1, 5), 0, 100)
    return update
  })
}

/** Запускает симулятор с интервалом из диапазона; возвращает функцию остановки. */
export function startSimulator(store: OrgStore, { minIntervalMs, maxIntervalMs, random = Math.random }: SimulatorOptions) {
  let timer: NodeJS.Timeout | undefined

  const schedule = () => {
    const delay = minIntervalMs + random() * Math.max(0, maxIntervalMs - minIntervalMs)
    timer = setTimeout(() => {
      store.update(proposeUpdates(store.snapshot(), random))
      schedule()
    }, delay)
  }

  schedule()
  return () => clearTimeout(timer)
}
