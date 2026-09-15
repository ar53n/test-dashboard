import { randomUUID } from 'node:crypto'
import type { OrgNode } from '../../shared/contract.ts'
import { generateOrgTree } from './data/generate.ts'

/**
 * In-memory состояние оргструктуры.
 * `epoch` меняется при каждом старте процесса: после рестарта номер ревизии может
 * повториться, но пара (epoch, revision) — нет.
 */
export class OrgStore {
  readonly epoch: string = randomUUID()
  #revision = 0
  #nodes: OrgNode[]

  constructor(nodes: OrgNode[] = generateOrgTree()) {
    this.#nodes = nodes
  }

  get revision(): number {
    return this.#revision
  }

  snapshot(): readonly OrgNode[] {
    return this.#nodes
  }
}
