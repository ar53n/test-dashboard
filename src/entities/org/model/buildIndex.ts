import type { OrgNode } from '@shared/contract.ts'

/** Нарушение структуры дерева: дубликат id, ссылка на несуществующего родителя или цикл. */
export class OrgStructureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrgStructureError'
  }
}

export interface OrgIndex {
  readonly nodes: ReadonlyMap<string, OrgNode>
  readonly children: ReadonlyMap<string, readonly string[]>
  readonly roots: readonly string[]
  /** Глубина узла: 0 — корень (дивизион). */
  readonly depth: ReadonlyMap<string, number>
  /** Порядок обхода в ширину от корней; в обратном порядке дети идут раньше родителей. */
  readonly topDownOrder: readonly string[]
}

const EMPTY_CHILDREN: readonly string[] = []

export function getChildren(index: OrgIndex, id: string): readonly string[] {
  return index.children.get(id) ?? EMPTY_CHILDREN
}

/** Строит индекс дерева из плоского массива за O(n) и проверяет его целостность. */
export function buildIndex(list: readonly OrgNode[]): OrgIndex {
  const nodes = new Map<string, OrgNode>()
  for (const node of list) {
    if (nodes.has(node.id)) throw new OrgStructureError(`Дубликат id «${node.id}»`)
    nodes.set(node.id, node)
  }

  const children = new Map<string, string[]>()
  const roots: string[] = []
  for (const node of list) {
    if (node.parentId === null) {
      roots.push(node.id)
      continue
    }
    if (!nodes.has(node.parentId)) {
      throw new OrgStructureError(`Узел «${node.id}» ссылается на несуществующего родителя «${node.parentId}»`)
    }
    const siblings = children.get(node.parentId)
    if (siblings) siblings.push(node.id)
    else children.set(node.parentId, [node.id])
  }

  const depth = new Map<string, number>()
  const topDownOrder: string[] = []
  for (const id of roots) depth.set(id, 0)
  topDownOrder.push(...roots)
  for (let i = 0; i < topDownOrder.length; i += 1) {
    const id = topDownOrder[i]
    const childDepth = depth.get(id)! + 1
    for (const childId of children.get(id) ?? EMPTY_CHILDREN) {
      depth.set(childId, childDepth)
      topDownOrder.push(childId)
    }
  }

  // Все родители существуют, поэтому недостижимые от корней узлы могут быть только в цикле.
  if (topDownOrder.length !== nodes.size) {
    const cyclic = list.find((node) => !depth.has(node.id))
    throw new OrgStructureError(`Цикл в иерархии: узел «${cyclic?.id}» недостижим от корней`)
  }

  return { nodes, children, roots, depth, topDownOrder }
}
