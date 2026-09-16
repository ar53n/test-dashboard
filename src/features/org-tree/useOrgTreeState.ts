import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getChildren, type OrgIndex } from '@/entities/org/model/buildIndex.ts'
import type { OrgSelection, SelectionSource } from '@/entities/org/model/selection.ts'

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

/**
 * Раскрытые ветви и выбранный узел. Состояние хранится выше дерева: оно переживает
 * размонтирование дерева (вкладки на узком экране) и общее для дерева и таблицы:
 * выбор в любой из панелей прокручивает к узлу соседнюю.
 * Пока пользователь ничего не менял, раскрытие вычисляется по умолчанию из индекса.
 */
export function useOrgTreeState(index: OrgIndex | undefined) {
  const [changedExpanded, setChangedExpanded] = useState<ReadonlySet<string> | null>(null)
  const [selection, setSelection] = useState<OrgSelection | null>(null)
  // Раскрытие по клику анимируется; раскрытие предков при выборе в таблице — мгновенное,
  // иначе прокрутка к узлу считала бы позицию по ещё не раскрытым ветвям.
  const [animate, setAnimate] = useState(true)

  // Патчи меняют ссылку на модель, но не структуру дерева (`topDownOrder` сохраняется).
  // Колбэки читают индекс через ref и остаются стабильными: иначе каждый патч
  // перерисовывал бы все строки таблицы, получающие `onSelect`.
  const structure = index?.topDownOrder
  const indexRef = useRef(index)
  useLayoutEffect(() => {
    indexRef.current = index
  }, [index])

  const expanded = useMemo(
    () => changedExpanded ?? (index ? getDefaultExpanded(index) : NO_NODES),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- пересчёт нужен только при смене структуры
    [changedExpanded, structure],
  )

  const toggle = useCallback(
    (id: string) => {
      setAnimate(true)
      setChangedExpanded((prev) => {
        const current = indexRef.current
        const next = new Set(prev ?? (current ? getDefaultExpanded(current) : NO_NODES))
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    [],
  )

  const select = useCallback((id: string, source: SelectionSource) => {
    const current = indexRef.current
    if (!current) return
    setAnimate(false)
    setChangedExpanded((prev) => withAncestorsExpanded(current, prev ?? getDefaultExpanded(current), id))
    setSelection((prev) => ({ id, request: (prev?.request ?? 0) + 1, source }))
  }, [])

  // Отдельные колбэки на панель: обе получают стабильную ссылку и не перерисовывают строки при патчах.
  const selectFromTree = useCallback((id: string) => select(id, 'tree'), [select])
  const selectFromTable = useCallback((id: string) => select(id, 'table'), [select])

  return { expanded, toggle, selection, selectFromTree, selectFromTable, animate }
}
