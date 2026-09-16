import type { KeyboardEvent } from 'react'
import styled from 'styled-components'
import type { SortDirection, SortKey, SortState } from './model/rows.ts'
import type { ColumnAlign } from './table.types.ts'

const HeaderCell = styled.th<{ $align: ColumnAlign }>`
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0;
  background: ${({ theme }) => theme.color.surface};
  border-bottom: 1px solid ${({ theme }) => theme.color.border};
  text-align: ${({ $align }) => $align};
  vertical-align: bottom;
  font-weight: 600;
`

const SortButton = styled.button<{ $align: ColumnAlign }>`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: ${({ $align }) => ($align === 'end' ? 'flex-end' : 'flex-start')};
  line-height: 1.25;
  gap: ${({ theme }) => theme.space(1)};
  padding: ${({ theme }) => `${theme.space(2.5)} ${theme.space(3)}`};
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.color.textMuted};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 600;
  text-align: inherit;
  cursor: pointer;
  /* Двойной клик не должен выделять текст заголовка. */
  user-select: none;

  &:hover,
  &[data-active='true'] {
    color: ${({ theme }) => theme.color.text};
  }

  &:focus-visible {
    outline-offset: -2px;
  }
`

const Arrow = styled.svg<{ $direction: SortDirection | null }>`
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  opacity: ${({ $direction }) => ($direction ? 1 : 0.35)};
  transform: rotate(${({ $direction }) => ($direction === 'desc' ? 180 : 0)}deg);
`

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
    <HeaderCell
      scope="col"
      $align={align}
      aria-sort={direction ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <SortButton
        type="button"
        $align={align}
        data-active={direction !== null}
        aria-describedby={hintId}
        onClick={() => onSort(sortKey, 'asc')}
        onDoubleClick={() => onSort(sortKey, 'desc')}
        onKeyDown={handleKeyDown}
      >
        {title}
        <Arrow $direction={direction} viewBox="0 0 10 10" aria-hidden="true">
          <path d="M5 1.5v7M2 4.5l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </Arrow>
      </SortButton>
    </HeaderCell>
  )
}
