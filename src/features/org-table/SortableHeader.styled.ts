import styled from 'styled-components'
import type { SortDirection } from './model/rows.ts'
import type { ColumnAlign } from './table.types.ts'

export const HeaderCell = styled.th<{ $align: ColumnAlign }>`
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

export const SortButton = styled.button<{ $align: ColumnAlign }>`
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

export const Arrow = styled.svg<{ $direction: SortDirection | null }>`
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  opacity: ${({ $direction }) => ($direction ? 1 : 0.35)};
  transform: rotate(${({ $direction }) => ($direction === 'desc' ? 180 : 0)}deg);
`
