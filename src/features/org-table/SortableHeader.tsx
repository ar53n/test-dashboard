import type { KeyboardEvent } from 'react'
import type { SortDirection, SortKey, SortState } from './model/rows.ts'
import * as S from './SortableHeader.styled.ts'
import type { ColumnAlign } from './table.types.ts'

interface SortableHeaderProps {
  sortKey: SortKey
  title: string
  align: ColumnAlign
  sort: SortState | null
  hintId: string
  onSort: (key: SortKey, direction: SortDirection) => void
}

/**
 * Клик сортирует по возрастанию, двойной клик — по убыванию. Двойной клик порождает
 * click, click, dblclick, поэтому результат не зависит от текущего состояния: всегда убывание.
 * С клавиатуры: Enter/Space — по возрастанию, Shift+Enter — по убыванию.
 */
export function SortableHeader({ sortKey, title, align, sort, hintId, onSort }: SortableHeaderProps) {
  const direction = sort?.key === sortKey ? sort.direction : null

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault()
      onSort(sortKey, 'desc')
    }
  }

  return (
    <S.HeaderCell
      scope="col"
      $align={align}
      aria-sort={direction ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <S.SortButton
        type="button"
        $align={align}
        data-active={direction !== null}
        aria-describedby={hintId}
        onClick={() => onSort(sortKey, 'asc')}
        onDoubleClick={() => onSort(sortKey, 'desc')}
        onKeyDown={handleKeyDown}
      >
        {title}
        <S.Arrow $direction={direction} viewBox="0 0 10 10" aria-hidden="true">
          <path d="M5 1.5v7M2 4.5l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </S.Arrow>
      </S.SortButton>
    </S.HeaderCell>
  )
}
