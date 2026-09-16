import { useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type RefObject } from 'react'
import type { OrgTableRow } from './model/rows.ts'

const NAVIGATION_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter'])

export function findRowElement(tbody: RefObject<HTMLTableSectionElement | null>, id: string | null) {
  return Array.from(tbody.current?.rows ?? []).find((row) => row.dataset.rowId === id)
}

/**
 * Клавиатурная навигация по строкам таблицы (roving tabindex) и сохранение фокуса.
 *
 * - Активная строка хранится по id: сортировка, фильтр и патчи не сбивают её.
 *   Если строка пропала из выборки, активной становится ближайшая по позиции.
 * - Фокус возвращается в таблицу, только если сфокусированная строка исчезла из выборки;
 *   если пользователь сам увёл фокус, обновления его не крадут.
 */
export function useTableNavigation(
  visibleRows: readonly OrgTableRow[],
  tbodyRef: RefObject<HTMLTableSectionElement | null>,
  onSelect: (id: string) => void,
) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [lastActiveIndex, setLastActiveIndex] = useState(0)
  const foundIndex = visibleRows.findIndex((row) => row.id === activeId)
  if (foundIndex >= 0 && foundIndex !== lastActiveIndex) setLastActiveIndex(foundIndex)
  const activeIndex = foundIndex >= 0 ? foundIndex : Math.min(lastActiveIndex, visibleRows.length - 1)
  const effectiveActiveId = visibleRows[activeIndex]?.id ?? null
  /** Строка, на которой сейчас фокус; `null`, если фокус ушёл из таблицы сам. */
  const focusedRowIdRef = useRef<string | null>(null)

  const focusRow = (id: string) => findRowElement(tbodyRef, id)?.focus()

  useLayoutEffect(() => {
    // При удалении узла браузер переносит фокус на body, а blur до React не доходит.
    // Если пользователь сам увёл фокус, onBlur уже сбросил ref.
    const focusedId = focusedRowIdRef.current
    if (!focusedId || visibleRows.some((row) => row.id === focusedId)) return
    focusedRowIdRef.current = null
    const focusLost = !document.activeElement || document.activeElement === document.body
    if (focusLost && effectiveActiveId) focusRow(effectiveActiveId)
  })

  const onKeyDown = (event: KeyboardEvent<HTMLTableSectionElement>) => {
    if (!NAVIGATION_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return
    if (!(event.target instanceof HTMLTableRowElement)) return
    // Отсчёт от строки, на которой фокус: она может не совпадать с активной (фокус мышью).
    const currentId = event.target.dataset.rowId
    const currentIndex = visibleRows.findIndex((row) => row.id === currentId)
    if (currentIndex < 0) return
    event.preventDefault()

    if (event.key === 'Enter') {
      onSelect(visibleRows[currentIndex].id)
      return
    }
    const lastIndex = visibleRows.length - 1
    const nextIndex = {
      ArrowUp: Math.max(0, currentIndex - 1),
      ArrowDown: Math.min(lastIndex, currentIndex + 1),
      Home: 0,
      End: lastIndex,
    }[event.key as 'ArrowUp' | 'ArrowDown' | 'Home' | 'End']
    const nextId = visibleRows[nextIndex].id
    setActiveId(nextId)
    focusRow(nextId)
  }

  const onFocus = (event: FocusEvent<HTMLTableSectionElement>) => {
    if (!(event.target instanceof HTMLTableRowElement)) return
    const id = event.target.dataset.rowId ?? null
    focusedRowIdRef.current = id
    setActiveId(id)
  }

  const onBlur = (event: FocusEvent<HTMLTableSectionElement>) => {
    // Переход на другую строку обновит ref в onFocus; любой уход из таблицы
    // (в том числе клик по нефокусируемому месту, relatedTarget = null) сбрасывает его.
    if (!event.currentTarget.contains(event.relatedTarget)) focusedRowIdRef.current = null
  }

  return {
    /** Строка, на которую попадает Tab. */
    activeId: effectiveActiveId,
    setActiveId,
    /** Обработчики для `<tbody>`. */
    tbodyProps: { onKeyDown, onFocus, onBlur },
  }
}
