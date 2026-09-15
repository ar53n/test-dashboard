import { useCallback, useMemo, useState } from 'react'
import { getChildren, type OrgIndex } from '@/entities/org/model/buildIndex.ts'

/**
 * Глубина, до которой узлы раскрыты по умолчанию: 0 — дивизионы, 1 — отделы.
 * При трёх уровнях команды видны сразу после загрузки.
 */
export const DEFAULT_EXPANDED_DEPTH = 1

const NO_NODES: ReadonlySet<string> = new Set()

export function getDefaultExpanded(index: OrgIndex): Set<string> {
  const expanded = new Set<string>()
  for (const id of index.topDownOrder) {
    if (index.depth.get(id)! <= DEFAULT_EXPANDED_DEPTH && getChildren(index, id).length > 0) expanded.add(id)
  }
  return expanded
}

/** Добавляет в множество раскрытых всех предков узла, чтобы узел стал виден. */
export function withAncestorsExpanded(index: OrgIndex, expanded: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(expanded)
  let parentId = index.nodes.get(id)?.parentId ?? null
  while (parentId !== null) {
    next.add(parentId)
    parentId = index.nodes.get(parentId)?.parentId ?? null
  }
  return next.size === expanded.size ? expanded : next
}

export interface TreeSelection {
  readonly id: string
  /** Растёт при каждом выборе, в том числе повторном: дерево заново прокручивает к узлу. */
  readonly request: number
}

/**
 * Раскрытые ветви и выбранный узел. Состояние хранится выше дерева: оно переживает
 * размонтирование дерева (вкладки на узком экране) и доступно таблице для выбора узла.
 * Пока пользователь ничего не менял, раскрытие вычисляется по умолчанию из индекса.
 */
export function useOrgTreeState(index: OrgIndex | undefined) {
  const [changedExpanded, setChangedExpanded] = useState<ReadonlySet<string> | null>(null)
  const [selection, setSelection] = useState<TreeSelection | null>(null)

  const expanded = useMemo(
    () => changedExpanded ?? (index ? getDefaultExpanded(index) : NO_NODES),
    [changedExpanded, index],
  )

  const toggle = useCallback(
    (id: string) => {
      setChangedExpanded((prev) => {
        const next = new Set(prev ?? (index ? getDefaultExpanded(index) : NO_NODES))
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    [index],
  )

  const select = useCallback(
    (id: string) => {
      if (!index) return
      setChangedExpanded((prev) => withAncestorsExpanded(index, prev ?? getDefaultExpanded(index), id))
      setSelection((prev) => ({ id, request: (prev?.request ?? 0) + 1 }))
    },
    [index],
  )

  return { expanded, toggle, selection, select }
}
