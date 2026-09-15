import { randomUUID } from 'node:crypto'
import type { MutableNodeField, NodeChange, OrgNode, PatchMessage } from '../../shared/contract.ts'
import { generateOrgTree } from './data/generate.ts'

/** Предлагаемое изменение узла. Поля, совпадающие с текущими значениями, отбрасываются. */
export type NodeUpdate = { id: string } & Partial<Pick<OrgNode, MutableNodeField>>

const MUTABLE_FIELDS: readonly MutableNodeField[] = ['name', 'headcount', 'budget', 'performance']

type PatchListener = (patch: PatchMessage) => void

/**
 * In-memory состояние оргструктуры.
 * `epoch` меняется при каждом старте процесса: после рестарта номер ревизии может
 * повториться, но пара (epoch, revision) — нет.
 */
export class OrgStore {
  readonly epoch: string = randomUUID()
  #revision = 0
  #nodes: OrgNode[]
  #indexById: Map<string, number>
  #listeners = new Set<PatchListener>()

  constructor(nodes: OrgNode[] = generateOrgTree()) {
    this.#nodes = nodes
    this.#indexById = new Map(nodes.map((node, index) => [node.id, index]))
  }

  get revision(): number {
    return this.#revision
  }

  snapshot(): readonly OrgNode[] {
    return this.#nodes
  }

  subscribe(listener: PatchListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  /**
   * Применяет изменения одной ревизией. В патч попадают только реально изменившиеся поля;
   * если не изменилось ничего, ревизия и `updatedAt` не растут и патч не рассылается.
   */
  update(updates: readonly NodeUpdate[], now: Date = new Date()): PatchMessage | null {
    const updatedAt = now.toISOString()
    const changesById = new Map<string, NodeChange>()
    const nextNodes = [...this.#nodes]

    for (const update of updates) {
      const index = this.#indexById.get(update.id)
      if (index === undefined) throw new Error(`Unknown node "${update.id}"`)

      const current = nextNodes[index]
      const diff: Partial<Pick<OrgNode, MutableNodeField>> = {}
      for (const field of MUTABLE_FIELDS) {
        const value = update[field]
        if (value !== undefined && value !== current[field]) Object.assign(diff, { [field]: value })
      }
      if (Object.keys(diff).length === 0) continue

      nextNodes[index] = { ...current, ...diff, updatedAt }
      const previous = changesById.get(update.id)
      changesById.set(update.id, { id: update.id, ...previous, ...diff, updatedAt })
    }

    if (changesById.size === 0) return null

    this.#nodes = nextNodes
    this.#revision += 1
    const patch: PatchMessage = { type: 'patch', epoch: this.epoch, revision: this.#revision, changes: [...changesById.values()] }
    for (const listener of this.#listeners) listener(patch)
    return patch
  }
}
