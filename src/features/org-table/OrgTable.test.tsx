// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOrgModel } from '@/entities/org/model/orgModel.ts'
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
  null,
)

function Harness({ onSelect = () => {} }: { onSelect?: (id: string) => void }) {
  const state = useOrgTableState()
  return <OrgTable model={model} state={state} selectedId={null} onSelect={onSelect} />
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
