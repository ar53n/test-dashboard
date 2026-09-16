import styled, { css } from 'styled-components'
import { flashHost } from '@/shared/ui/Flash/index.ts'
import type { ColumnAlign } from './table.types.ts'

export const Layout = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`

export const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => `${theme.space(2)} ${theme.space(4)}`};
  padding: ${({ theme }) => `${theme.space(3)} ${theme.space(4)}`};
  border-bottom: 1px solid ${({ theme }) => theme.color.border};
`

export const Counter = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.color.textMuted};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-variant-numeric: tabular-nums;
`

export const Table = styled.table`
  width: 100%;
  min-width: 720px;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
  font-variant-numeric: tabular-nums;
`

export const Column = styled.col<{ $width?: string }>`
  width: ${({ $width = 'auto' }) => $width};
`

export const Row = styled.tr<{ $selected: boolean }>`
  cursor: pointer;
  /* При фокусе с клавиатуры строка не прячется под закреплённым заголовком. */
  scroll-margin-top: 56px;

  &:hover > td {
    background: ${({ theme }) => theme.color.surfaceHover};
  }

  ${({ $selected, theme }) =>
    $selected &&
    css`
      & > td,
      &:hover > td {
        background: ${theme.color.surfaceSelected};
      }

      & > td:first-child {
        box-shadow: inset 3px 0 0 ${theme.color.accent};
      }
    `}

  /* Рамка фокуса рисуется на ячейках: outline строки перекрывают ячейки со своим контекстом наложения. */
  &:focus-visible {
    outline: none;
  }

  &:focus-visible > td {
    box-shadow:
      inset 0 2px 0 ${({ theme }) => theme.color.focus},
      inset 0 -2px 0 ${({ theme }) => theme.color.focus};
  }

  &:focus-visible > td:first-child {
    box-shadow:
      inset 2px 0 0 ${({ theme }) => theme.color.focus},
      inset 0 2px 0 ${({ theme }) => theme.color.focus},
      inset 0 -2px 0 ${({ theme }) => theme.color.focus};
  }

  &:focus-visible > td:last-child {
    box-shadow:
      inset -2px 0 0 ${({ theme }) => theme.color.focus},
      inset 0 2px 0 ${({ theme }) => theme.color.focus},
      inset 0 -2px 0 ${({ theme }) => theme.color.focus};
  }
`

export const Cell = styled.td<{ $align?: ColumnAlign }>`
  padding: ${({ theme }) => `${theme.space(2)} ${theme.space(3)}`};
  border-bottom: 1px solid ${({ theme }) => theme.color.border};
  text-align: ${({ $align = 'start' }) => $align};
  white-space: nowrap;
`

export const MetricCell = styled(Cell)`
  ${flashHost};
`

export const NameCell = styled(Cell)<{ $indent: number; $level: number }>`
  padding-left: ${({ theme, $indent }) => `calc(${theme.space(3)} + ${$indent * 16}px)`};
  font-weight: ${({ $level }) => ($level === 1 ? 600 : 400)};
  white-space: normal;
  overflow-wrap: anywhere;
`

export const Muted = styled.span`
  color: ${({ theme }) => theme.color.textMuted};
`
