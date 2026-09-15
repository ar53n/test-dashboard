import { memo, useId, useMemo } from 'react'
import styled, { css } from 'styled-components'
import { getLevelLabel } from '@/entities/org/model/level.ts'
import type { OrgModel } from '@/entities/org/model/orgModel.ts'
import { PerformanceIndicator } from '@/entities/org/ui/PerformanceIndicator.tsx'
import { formatBudget, formatInteger } from '@/shared/lib/format.ts'
import { Button } from '@/shared/ui/Button.ts'
import { EmptyState } from '@/shared/ui/StateView.tsx'
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden.ts'
import { buildRows, filterRows, sortRows, type OrgTableRow, type SortKey } from './model/rows.ts'
import { SortableHeader, type ColumnAlign } from './SortableHeader.tsx'
import type { OrgTableState } from './useOrgTableState.ts'

/**
 * Ширины числовых столбцов фиксированы (`table-layout: fixed`): при фильтрации, сортировке
 * и обновлении значений столбцы не «прыгают», а всё свободное место получает название.
 */
const COLUMNS: readonly { key: SortKey; title: string; align: ColumnAlign; width?: string }[] = [
  { key: 'name', title: 'Подразделение', align: 'start' },
  { key: 'level', title: 'Уровень', align: 'start', width: '96px' },
  { key: 'totalHeadcount', title: 'Всего сотрудников', align: 'end', width: '104px' },
  { key: 'totalBudget', title: 'Бюджет суммарный', align: 'end', width: '160px' },
  { key: 'avgPerformance', title: 'Средняя эффективность', align: 'end', width: '120px' },
]

const Layout = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => `${theme.space(2)} ${theme.space(4)}`};
  padding: ${({ theme }) => `${theme.space(3)} ${theme.space(4)}`};
  border-bottom: 1px solid ${({ theme }) => theme.color.border};
`

const SearchInput = styled.input`
  flex: 1 1 240px;
  max-width: 360px;
  padding: ${({ theme }) => `${theme.space(2)} ${theme.space(3)}`};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.surface};
  color: inherit;
  font: inherit;

  &::placeholder {
    color: ${({ theme }) => theme.color.textMuted};
  }

  &:focus-visible {
    outline-offset: 0;
    border-color: ${({ theme }) => theme.color.focus};
  }
`

const Counter = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.color.textMuted};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-variant-numeric: tabular-nums;
`

const ScrollArea = styled.div`
  /* Контейнер для скрытых подписей (position: absolute), иначе они выходят за overflow и растягивают страницу. */
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
`

const Table = styled.table`
  width: 100%;
  min-width: 720px;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
  font-variant-numeric: tabular-nums;
`

const Column = styled.col<{ $width?: string }>`
  width: ${({ $width = 'auto' }) => $width};
`

const Row = styled.tr<{ $selected: boolean }>`
  cursor: pointer;

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
`

const Cell = styled.td<{ $align?: ColumnAlign }>`
  padding: ${({ theme }) => `${theme.space(2)} ${theme.space(3)}`};
  border-bottom: 1px solid ${({ theme }) => theme.color.border};
  text-align: ${({ $align = 'start' }) => $align};
  white-space: nowrap;
`

const NameCell = styled(Cell)<{ $indent: number; $level: number }>`
  padding-left: ${({ theme, $indent }) => `calc(${theme.space(3)} + ${$indent * 16}px)`};
  font-weight: ${({ $level }) => ($level === 1 ? 600 : 400)};
  white-space: normal;
  overflow-wrap: anywhere;
`

const Muted = styled.span`
  color: ${({ theme }) => theme.color.textMuted};
`

interface TableRowProps {
  row: OrgTableRow
  indent: boolean
  selected: boolean
  onSelect: (id: string) => void
}

const TableRow = memo(function TableRow({ row, indent, selected, onSelect }: TableRowProps) {
  return (
    <Row $selected={selected} onClick={() => onSelect(row.id)}>
      <NameCell $indent={indent ? row.level - 1 : 0} $level={row.level}>
        {row.name}
        {selected && <VisuallyHidden>, выбрано</VisuallyHidden>}
      </NameCell>
      <Cell>
        <Muted>{getLevelLabel(row.level)}</Muted>
      </Cell>
      <Cell $align="end">{formatInteger(row.totalHeadcount)}</Cell>
      <Cell $align="end">{formatBudget(row.totalBudget)}</Cell>
      <Cell $align="end">
        <PerformanceIndicator value={row.avgPerformance} precise />
      </Cell>
    </Row>
  )
})

interface OrgTableProps {
  model: OrgModel
  state: OrgTableState
  selectedId: string | null
  onSelect: (id: string) => void
}

export function OrgTable({ model, state, selectedId, onSelect }: OrgTableProps) {
  const { search, setSearch, appliedSearch, sort, sortBy } = state
  const searchId = useId()
  const hintId = useId()

  // Строки берут готовые агрегаты модели. Сортировка мемоизирована отдельно от фильтра,
  // поэтому ввод в поиск не пересортировывает строки.
  const rows = useMemo(() => buildRows(model), [model])
  const sortedRows = useMemo(() => sortRows(rows, sort), [rows, sort])
  const visibleRows = useMemo(() => filterRows(sortedRows, appliedSearch), [sortedRows, appliedSearch])

  return (
    <Layout>
      <Toolbar>
        <VisuallyHidden as="label" htmlFor={searchId}>
          Поиск по названию подразделения
        </VisuallyHidden>
        <SearchInput
          id={searchId}
          type="search"
          placeholder="Поиск по названию…"
          autoComplete="off"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Counter aria-live="polite">
          {appliedSearch
            ? `Найдено ${formatInteger(visibleRows.length)} из ${formatInteger(rows.length)}`
            : `${formatInteger(rows.length)} подразделений`}
        </Counter>
      </Toolbar>

      {visibleRows.length === 0 ? (
        <EmptyState
          title="Ничего не найдено"
          description={`Нет подразделений, в названии которых есть «${appliedSearch.trim()}».`}
          action={
            <Button type="button" onClick={() => setSearch('')}>
              Сбросить поиск
            </Button>
          }
        />
      ) : (
        <ScrollArea>
          <VisuallyHidden id={hintId}>
            Нажмите, чтобы отсортировать по возрастанию; двойной клик или Shift+Enter — по убыванию.
          </VisuallyHidden>
          <Table aria-label="Подразделения с суммарными показателями">
            <colgroup>
              {COLUMNS.map((column) => (
                <Column key={column.key} $width={column.width} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <SortableHeader
                    key={column.key}
                    sortKey={column.key}
                    title={column.title}
                    align={column.align}
                    sort={sort}
                    hintId={hintId}
                    onSort={sortBy}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <TableRow
                  key={row.id}
                  row={row}
                  indent={sort === null}
                  selected={row.id === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </tbody>
          </Table>
        </ScrollArea>
      )}
    </Layout>
  )
}
