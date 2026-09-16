// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyPatch } from '@/entities/org/model/applyPatch.ts'
import { createOrgModel, type OrgModel } from '@/entities/org/model/orgModel.ts'
import { makeNode } from '@/entities/org/model/testUtils.ts'
import { renderWithTheme } from '@/shared/ui/renderWithTheme.ts'
import { OrgTable } from './OrgTable.tsx'
import { SEARCH_DEBOUNCE_MS, useOrgTableState } from './useOrgTableState.ts'

const model = createOrgModel(
  [
    makeNode('sales', null, { name: 'Продажи', headcount: 2, budget: 1_000_000 }),
    makeNode('tech', null, { name: 'Технологии', headcount: 1, budget: 12_000_000 }),
    makeNode('platform', 'tech', { name: 'Платформа', headcount: 40, budget: 345_678 }),
  ],
  { epoch: 'e1', revision: 0 },
)

function Harness({ onSelect = () => {}, data = model }: { onSelect?: (id: string) => void; data?: OrgModel }) {
  const state = useOrgTableState()
  return <OrgTable model={data} state={state} selection={null} onSelect={onSelect} />
}

const bodyRowNames = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent)

const header = (name: string) => screen.getByRole('columnheader', { name: new RegExp(name) })
const sortButton = (name: string) => within(header(name)).getByRole('button')

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('OrgTable: содержимое', () => {
  it('показывает столбцы ТЗ и суммарные показатели узла с потомками', () => {
    renderWithTheme(<Harness />)

    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Подразделение',
      'Уровень',
      'Всего сотрудников',
      'Бюджет суммарный',
      'Средняя эффективность',
    ])
    const techRow = screen.getByRole('row', { name: /Технологии/ })
    const cells = within(techRow).getAllByRole('cell').map((cell) => cell.textContent!.replace(/\u00a0/g, ' '))
    expect(cells[1]).toBe('Дивизион')
    expect(cells[2]).toBe('41')
    expect(cells[3]).toBe('12 345 678 руб.')
  })

  it('клик по строке выбирает узел', () => {
    const onSelect = vi.fn()
    renderWithTheme(<Harness onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('cell', { name: 'Платформа' }))
    expect(onSelect).toHaveBeenCalledWith('platform')
  })
})

describe('OrgTable: сортировка', () => {
  it('клик — по возрастанию, двойной клик — по убыванию', () => {
    renderWithTheme(<Harness />)
    expect(bodyRowNames()).toEqual(['Продажи', 'Технологии', 'Платформа'])

    fireEvent.click(sortButton('Бюджет суммарный'))
    expect(header('Бюджет суммарный').getAttribute('aria-sort')).toBe('ascending')
    expect(bodyRowNames()).toEqual(['Платформа', 'Продажи', 'Технологии'])

    // Настоящий двойной клик браузер доставляет как click, click, dblclick.
    const button = sortButton('Бюджет суммарный')
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.doubleClick(button)
    expect(header('Бюджет суммарный').getAttribute('aria-sort')).toBe('descending')
    expect(bodyRowNames()).toEqual(['Технологии', 'Продажи', 'Платформа'])

    // Двойной клик по уже убывающей сортировке оставляет убывание, одиночный клик возвращает возрастание.
    fireEvent.click(button)
    expect(header('Бюджет суммарный').getAttribute('aria-sort')).toBe('ascending')
  })

  it('aria-sort только у активного столбца; Shift+Enter сортирует по убыванию', () => {
    renderWithTheme(<Harness />)
    fireEvent.keyDown(sortButton('Всего сотрудников'), { key: 'Enter', shiftKey: true })

    expect(header('Всего сотрудников').getAttribute('aria-sort')).toBe('descending')
    expect(header('Подразделение').hasAttribute('aria-sort')).toBe(false)
    expect(bodyRowNames()).toEqual(['Технологии', 'Платформа', 'Продажи'])
  })
})

describe('OrgTable: поиск', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  const typeSearch = (value: string) =>
    fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск по названию подразделения' }), {
      target: { value },
    })

  it(`фильтрует по названию через ${SEARCH_DEBOUNCE_MS} мс после последнего ввода`, () => {
    renderWithTheme(<Harness />)

    typeSearch('плат')
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1))
    expect(bodyRowNames()).toHaveLength(3)

    typeSearch('платф')
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1))
    expect(bodyRowNames()).toHaveLength(3)

    act(() => vi.advanceTimersByTime(1))
    expect(bodyRowNames()).toEqual(['Платформа'])
    expect(screen.getByText('Найдено 1 из 3')).toBeTruthy()
  })

  it('очистка поля возвращает все строки сразу', () => {
    renderWithTheme(<Harness />)
    typeSearch('плат')
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS))
    expect(bodyRowNames()).toHaveLength(1)

    typeSearch('')
    expect(bodyRowNames()).toHaveLength(3)
  })

  it('нет совпадений — отдельное состояние с кнопкой сброса', () => {
    renderWithTheme(<Harness />)
    typeSearch('бухгалтерия')
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS))

    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText('Ничего не найдено')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Сбросить поиск' }))
    expect(bodyRowNames()).toHaveLength(3)
  })
})

describe('OrgTable: клавиатура', () => {
  const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
  const focusedName = () => (document.activeElement as HTMLElement).querySelector('td')?.textContent

  it('Tab попадает на одну строку; стрелки, Home/End перемещают фокус, Enter выбирает', () => {
    const onSelect = vi.fn()
    renderWithTheme(<Harness onSelect={onSelect} />)
    expect(rows().map((row) => row.tabIndex)).toEqual([0, -1, -1])

    rows()[0].focus()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(focusedName()).toBe('Технологии')
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(focusedName()).toBe('Платформа')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(focusedName()).toBe('Платформа')
    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    expect(focusedName()).toBe('Продажи')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    expect(focusedName()).toBe('Продажи')
    expect(rows().map((row) => row.tabIndex)).toEqual([0, -1, -1])

    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('platform')
    expect(rows().map((row) => row.tabIndex)).toEqual([-1, -1, 0])
  })

  it('активная строка хранится по id: после сортировки остаётся той же строкой', () => {
    renderWithTheme(<Harness />)
    rows()[1].focus()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(focusedName()).toBe('Платформа')

    fireEvent.click(sortButton('Всего сотрудников'))
    const active = rows().find((row) => row.tabIndex === 0)!
    expect(within(active).getAllByRole('cell')[0].textContent).toBe('Платформа')
  })

  it('если активная строка исчезла из выборки, активной становится ближайшая', () => {
    vi.useFakeTimers()
    renderWithTheme(<Harness />)
    rows()[2].focus()
    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    fireEvent.keyDown(document.activeElement!, { key: 'End' })

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'и' } })
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS))
    // «Платформа» без «и» не проходит: остаются «Продажи» и «Технологии», активна ближайшая — последняя.
    expect(bodyRowNames()).toEqual(['Продажи', 'Технологии'])
    expect(rows().map((row) => row.tabIndex)).toEqual([-1, 0])
  })
})

describe('OrgTable: фокус при обновлениях', () => {
  const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
  const withHeadcount = (headcount: number, revision: number) =>
    applyPatch(model, {
      type: 'patch',
      epoch: 'e1',
      revision,
      changes: [{ id: 'platform', headcount, updatedAt: '2026-09-15T10:00:00.000Z' }],
    })

  it('фокус ушёл из таблицы на нефокусируемое содержимое — патч не возвращает его в таблицу', () => {
    const { rerender } = renderWithTheme(<Harness data={model} />)
    rows()[1].focus()
    // Клик по нефокусируемому месту страницы: blur с relatedTarget = null, фокус на body.
    rows()[1].blur()
    expect(document.activeElement).toBe(document.body)

    rerender(<Harness data={withHeadcount(45, 1)} />)
    expect(document.activeElement).toBe(document.body)
  })

  it('сфокусированная строка исчезла из выборки — фокус переходит на ближайшую', () => {
    vi.useFakeTimers()
    renderWithTheme(<Harness />)
    rows()[2].focus()
    expect(within(rows()[2]).getAllByRole('cell')[0].textContent).toBe('Платформа')

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'и' } })
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS))

    expect(bodyRowNames()).toEqual(['Продажи', 'Технологии'])
    expect((document.activeElement as HTMLElement).querySelector('td')?.textContent).toBe('Технологии')
  })
})

describe('OrgTable: live-обновления', () => {
  const patched = (headcount: number, revision: number, base: OrgModel) =>
    applyPatch(base, {
      type: 'patch',
      epoch: 'e1',
      revision,
      changes: [{ id: 'platform', headcount, updatedAt: '2026-09-15T10:00:00.000Z' }],
    })
  const flashedCells = () =>
    Array.from(document.querySelectorAll('td > span[aria-hidden="true"]')).map((overlay) => {
      const cell = overlay.parentElement!
      return `${cell.closest('tr')!.querySelector('td')!.textContent}:${cell.textContent!.replace(/\u00a0/g, ' ')}`
    })

  it('подсвечивает изменившиеся ячейки узла и предков; первый рендер не подсвечивается', () => {
    const { rerender } = renderWithTheme(<Harness data={model} />)
    expect(flashedCells()).toEqual([])

    rerender(<Harness data={patched(45, 1, model)} />)
    expect(flashedCells()).toEqual(['Технологии:46', 'Платформа:45'])
  })

  it('подсвечивает изменённое название', () => {
    const { rerender } = renderWithTheme(<Harness data={model} />)
    rerender(
      <Harness
        data={applyPatch(model, {
          type: 'patch',
          epoch: 'e1',
          revision: 1,
          changes: [{ id: 'platform', name: 'Платформа 2.0', updatedAt: '2026-09-15T10:00:00.000Z' }],
        })}
      />,
    )
    expect(flashedCells()).toEqual(['Платформа 2.0:Платформа 2.0'])
  })

  it('то же показанное значение не подсвечивается повторно', () => {
    const first = patched(45, 1, model)
    const { rerender } = renderWithTheme(<Harness data={first} />)
    // Изменился только updatedAt — показанные значения те же.
    rerender(
      <Harness
        data={applyPatch(first, {
          type: 'patch',
          epoch: 'e1',
          revision: 2,
          changes: [{ id: 'platform', updatedAt: '2026-09-15T11:00:00.000Z' }],
        })}
      />,
    )
    expect(flashedCells()).toEqual([])
  })
})
