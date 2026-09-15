import {
  memo,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import styled, { css } from 'styled-components'
import { getLevelLabel } from '@/entities/org/model/level.ts'
import type { OrgModel } from '@/entities/org/model/orgModel.ts'
import { PerformanceIndicator } from '@/entities/org/ui/PerformanceIndicator.tsx'
import { formatBudget, formatDecimal, formatInteger } from '@/shared/lib/format.ts'
import { Button } from '@/shared/ui/Button.ts'
import { FlashOverlay } from '@/shared/ui/Flash.tsx'
import { flashHost, useChangeCount } from '@/shared/ui/flash.ts'
import { EmptyState } from '@/shared/ui/StateView.tsx'
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden.ts'
import { applyOrgFilter } from './model/applyOrgFilter.ts'
import { buildRows, filterRows, sortRows, type OrgTableRow, type SortKey } from './model/rows.ts'
import { SearchBar } from './SearchBar.tsx'
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

const Cell = styled.td<{ $align?: ColumnAlign }>`
  padding: ${({ theme }) => `${theme.space(2)} ${theme.space(3)}`};
  border-bottom: 1px solid ${({ theme }) => theme.color.border};
  text-align: ${({ $align = 'start' }) => $align};
  white-space: nowrap;
`

const MetricCell = styled(Cell)`
  ${flashHost};
`

/** Ячейка, которая подсвечивается при изменении показанного значения. */
function FlashCell({ text, children }: { text: string; children?: ReactNode }) {
  const changes = useChangeCount(text)
  return (
    <MetricCell $align="end">
      {changes > 0 && <FlashOverlay key={changes} aria-hidden="true" />}
      {children ?? text}
    </MetricCell>
  )
}

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
  /** Строка, на которую попадает Tab (roving tabindex). */
  active: boolean
  onRowClick: (id: string) => void
}

const TableRow = memo(function TableRow({ row, indent, selected, active, onRowClick }: TableRowProps) {
  const performanceText = row.avgPerformance === null ? '—' : formatDecimal(row.avgPerformance)
  return (
    <Row $selected={selected} data-row-id={row.id} tabIndex={active ? 0 : -1} onClick={() => onRowClick(row.id)}>
      <NameCell $indent={indent ? row.level - 1 : 0} $level={row.level}>
        {row.name}
        {selected && <VisuallyHidden>, выбрано</VisuallyHidden>}
      </NameCell>
      <Cell>
        <Muted>{getLevelLabel(row.level)}</Muted>
      </Cell>
      <FlashCell text={formatInteger(row.totalHeadcount)} />
      <FlashCell text={formatBudget(row.totalBudget)} />
      <FlashCell text={performanceText}>
        <PerformanceIndicator value={row.avgPerformance} precise />
      </FlashCell>
    </Row>
  )
})

const NAVIGATION_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter'])

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
  selectedId: string | null
  onSelect: (id: string) => void
}

export function OrgTable({ model, state, selectedId, onSelect }: OrgTableProps) {
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

  // Активная строка хранится по id: сортировка, фильтр и патчи не сбивают её.
  // Если строка пропала из выборки, активной становится ближайшая по позиции.
  const [activeId, setActiveId] = useState<string | null>(null)
  const [lastActiveIndex, setLastActiveIndex] = useState(0)
  const foundIndex = visibleRows.findIndex((row) => row.id === activeId)
  if (foundIndex >= 0 && foundIndex !== lastActiveIndex) setLastActiveIndex(foundIndex)
  const activeIndex = foundIndex >= 0 ? foundIndex : Math.min(lastActiveIndex, visibleRows.length - 1)
  const effectiveActiveId = visibleRows[activeIndex]?.id ?? null
  /** Строка, на которой сейчас фокус; `null`, если фокус ушёл из таблицы сам. */
  const focusedRowIdRef = useRef<string | null>(null)

  const focusRow = (id: string) => {
    const element = Array.from(tbodyRef.current?.rows ?? []).find((row) => row.dataset.rowId === id)
    element?.focus()
  }

  useLayoutEffect(() => {
    // Фокус возвращается, только если сфокусированная строка действительно исчезла из выборки
    // (при удалении узла браузер переносит фокус на body, а blur до React не доходит).
    // Если пользователь сам увёл фокус, onBlur уже сбросил ref, и обновления фокус не крадут.
    const focusedId = focusedRowIdRef.current
    if (!focusedId || visibleRows.some((row) => row.id === focusedId)) return
    focusedRowIdRef.current = null
    const focusLost = !document.activeElement || document.activeElement === document.body
    if (focusLost && effectiveActiveId) focusRow(effectiveActiveId)
  })

  const handleRowClick = useCallback(
    (id: string) => {
      setActiveId(id)
      onSelect(id)
    },
    [onSelect],
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLTableSectionElement>) => {
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

  return (
    <Layout>
      <Toolbar>
        <SearchBar
          state={state}
          counter={
            <Counter aria-live="polite">
              {filtered
                ? `Найдено ${formatInteger(visibleRows.length)} из ${formatInteger(rows.length)}`
                : `${formatInteger(rows.length)} подразделений`}
            </Counter>
          }
        />
      </Toolbar>

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
          <Table aria-label="Подразделения с суммарными показателями" aria-describedby={rowsHintId}>
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
            <tbody
              ref={tbodyRef}
              onKeyDown={handleKeyDown}
              onFocus={(event) => {
                if (!(event.target instanceof HTMLTableRowElement)) return
                const id = event.target.dataset.rowId ?? null
                focusedRowIdRef.current = id
                setActiveId(id)
              }}
              onBlur={(event) => {
                // Переход на другую строку обновит ref в onFocus; любой уход из таблицы
                // (в том числе клик по нефокусируемому месту, relatedTarget = null) сбрасывает его.
                if (!event.currentTarget.contains(event.relatedTarget)) focusedRowIdRef.current = null
              }}
            >
              {visibleRows.map((row) => (
                <TableRow
                  key={row.id}
                  row={row}
                  indent={sort === null && !aiFilter}
                  selected={row.id === selectedId}
                  active={row.id === effectiveActiveId}
                  onRowClick={handleRowClick}
                />
              ))}
            </tbody>
          </Table>
        </ScrollArea>
      )}
    </Layout>
  )
}
