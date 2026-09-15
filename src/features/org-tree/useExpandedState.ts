import { useCallback, useState } from 'react'
import { getChildren, type OrgIndex } from '@/entities/org/model/buildIndex.ts'

/**
 * Глубина, до которой узлы раскрыты по умолчанию: 0 — дивизионы, 1 — отделы.
 * При трёх уровнях команды видны сразу после загрузки.
 */
export const DEFAULT_EXPANDED_DEPTH = 1

export function getDefaultExpanded(index: OrgIndex): Set<string> {
  const expanded = new Set<string>()
  for (const id of index.topDownOrder) {
    if (index.depth.get(id)! <= DEFAULT_EXPANDED_DEPTH && getChildren(index, id).length > 0) expanded.add(id)
  }
  return expanded
}

export function useExpandedState(index: OrgIndex) {
  const [expanded, setExpanded] = useState(() => getDefaultExpanded(index))

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return { expanded, toggle }
}
