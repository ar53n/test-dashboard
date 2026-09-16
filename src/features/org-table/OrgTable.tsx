import { memo, useCallback, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { getLevelLabel } from '@/entities/org/model/level.ts'
import type { OrgModel } from '@/entities/org/model/orgModel.ts'
import type { OrgSelection } from '@/entities/org/model/selection.ts'
import { PerformanceIndicator } from '@/entities/org/ui/PerformanceIndicator/index.ts'
import { formatBudget, formatDecimal, formatInteger } from '@/shared/lib/format.ts'
import { useScrollToSelected } from '@/shared/lib/useScrollToSelected.ts'
import { Button } from '@/shared/ui/Button/index.ts'
import { FlashOverlay, useChangeCount } from '@/shared/ui/Flash/index.ts'
import { ScrollArea } from '@/shared/ui/ScrollArea/index.ts'
import { EmptyState } from '@/shared/ui/StateView/index.ts'
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden/index.ts'
import { applyOrgFilter } from './model/applyOrgFilter.ts'
import { buildRows, filterRows, sortRows, type OrgTableRow } from './model/rows.ts'
import * as S from './OrgTable.styled.ts'
import { SearchBar } from './SearchBar.tsx'
import { SortableHeader } from './SortableHeader.tsx'
import type { TableColumn } from './table.types.ts'
import type { OrgTableState } from './useOrgTableState.ts'
import { findRowElement, useTableNavigation } from './useTableNavigation.ts'

/**
 * Ширины числовых столбцов фиксированы (`table-layout: fixed`): при фильтрации, сортировке
 * и обновлении значений столбцы не «прыгают», а всё свободное место получает название.
 */
const COLUMNS: readonly TableColumn[] = [
  { key: 'name', title: 'Подразделение', align: 'start' },
  { key: 'level', title: 'Уровень', align: 'start', width: '96px' },
  { key: 'totalHeadcount', title: 'Всего сотрудников', align: 'end', width: '104px' },
  { key: 'totalBudget', title: 'Бюджет суммарный', align: 'end', width: '160px' },
  { key: 'avgPerformance', title: 'Средняя эффективность', align: 'end', width: '120px' },
]

/** Ячейка, которая подсвечивается при изменении показанного значения. */
function FlashCell({ text, children }: { text: string; children?: ReactNode }) {
  const changes = useChangeCount(text)
  return (
    <S.MetricCell $align="end">
      {changes > 0 && <FlashOverlay key={changes} aria-hidden="true" />}
      {children ?? text}
    </S.MetricCell>
  )
}

interface TableRowProps {
  row: OrgTableRow
  indent: boolean
  selected: boolean
  /** Строка, на которую попадает Tab (roving tabindex). */
  active: boolean
  onRowClick: (id: string) => void
}

const TableRow = memo(function TableRow({ row, indent, selected, active, onRowClick }: TableRowProps) {
  const performanceText = row.avgPerformance === null ? '—' : formatDecimal(row.avgPerformance)
  const nameChanges = useChangeCount(row.name)
  return (
    <S.Row $selected={selected} data-row-id={row.id} tabIndex={active ? 0 : -1} onClick={() => onRowClick(row.id)}>
      <S.NameCell $indent={indent ? row.level - 1 : 0} $level={row.level}>
        {nameChanges > 0 && <FlashOverlay key={nameChanges} aria-hidden="true" />}
        {row.name}
        {selected && <VisuallyHidden>, выбрано</VisuallyHidden>}
      </S.NameCell>
      <S.Cell>
        <S.Muted>{getLevelLabel(row.level)}</S.Muted>
      </S.Cell>
      <FlashCell text={formatInteger(row.totalHeadcount)} />
      <FlashCell text={formatBudget(row.totalBudget)} />
      <FlashCell text={performanceText}>
        <PerformanceIndicator value={row.avgPerformance} precise />
      </FlashCell>
    </S.Row>
  )
})

/** Строки текущей модели; при смене модели неизменённые строки берутся из прошлой версии. */
function useTableRows(model: OrgModel): readonly OrgTableRow[] {
  const [state, setState] = useState(() => {
    const rows = buildRows(model)
    return { model, rows, byId: new Map(rows.map((row) => [row.id, row])) }
  })
  if (state.model === model) return state.rows

  const rows = buildRows(model, state.byId)
  setState({ model, rows, byId: new Map(rows.map((row) => [row.id, row])) })
  return rows
}

interface OrgTableProps {
  model: OrgModel
  state: OrgTableState
  selection: OrgSelection | null
  onSelect: (id: string) => void
}

export function OrgTable({ model, state, selection, onSelect }: OrgTableProps) {
  const selectedId = selection?.id ?? null
  const { appliedSearch, aiFilter, resetSearch, sort, sortBy } = state
  const hintId = useId()
  const rowsHintId = useId()
  const tbodyRef = useRef<HTMLTableSectionElement>(null)

  // Строки берут готовые агрегаты модели и переиспользуют неизменённые объекты прошлой версии.
  // Сортировка мемоизирована отдельно от фильтра, поэтому ввод в поиск не пересортировывает строки.
  const rows = useTableRows(model)
  const sortedRows = useMemo(() => sortRows(rows, sort), [rows, sort])
  const visibleRows = useMemo(
    () => (aiFilter ? applyOrgFilter(sortedRows, model, aiFilter) : filterRows(sortedRows, appliedSearch)),
    [sortedRows, model, aiFilter, appliedSearch],
  )
  const filtered = aiFilter !== null || appliedSearch !== ''

  const navigation = useTableNavigation(visibleRows, tbodyRef, onSelect)
  const { setActiveId } = navigation

  // Прокрутка к строке при выборе узла в дереве. Если строка отфильтрована поиском,
  // прокручивать нечего — выбор просто не виден в таблице.
  useScrollToSelected(selection?.request, selection?.source === 'table', () => findRowElement(tbodyRef, selectedId))

  const handleRowClick = useCallback(
    (id: string) => {
      setActiveId(id)
      onSelect(id)
    },
    [setActiveId, onSelect],
  )

  return (
    <S.Layout>
      <S.Toolbar>
        <SearchBar
          state={state}
          counter={
            <S.Counter aria-live="polite">
              {filtered
                ? `Найдено ${formatInteger(visibleRows.length)} из ${formatInteger(rows.length)}`
                : `${formatInteger(rows.length)} подразделений`}
            </S.Counter>
          }
        />
      </S.Toolbar>

      {visibleRows.length === 0 ? (
        <EmptyState
          title="Ничего не найдено"
          description={
            aiFilter
              ? 'Нет подразделений, подходящих под AI-фильтр.'
              : `Нет подразделений, в названии которых есть «${appliedSearch.trim()}».`
          }
          action={
            <Button type="button" onClick={resetSearch}>
              Сбросить поиск
            </Button>
          }
        />
      ) : (
        <ScrollArea>
          <VisuallyHidden id={hintId}>
            Нажмите, чтобы отсортировать по возрастанию; двойной клик или Shift+Enter — по убыванию.
          </VisuallyHidden>
          <VisuallyHidden id={rowsHintId}>
            Стрелки вверх и вниз, Home и End — переход по строкам; Enter — показать подразделение в дереве.
          </VisuallyHidden>
          <S.Table aria-label="Подразделения с суммарными показателями" aria-describedby={rowsHintId}>
            <colgroup>
              {COLUMNS.map((column) => (
                <S.Column key={column.key} $width={column.width} />
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
            <tbody ref={tbodyRef} {...navigation.tbodyProps}>
              {visibleRows.map((row) => (
                <TableRow
                  key={row.id}
                  row={row}
                  indent={sort === null && !aiFilter}
                  selected={row.id === selectedId}
                  active={row.id === navigation.activeId}
                  onRowClick={handleRowClick}
                />
              ))}
            </tbody>
          </S.Table>
        </ScrollArea>
      )}
    </S.Layout>
  )
}
