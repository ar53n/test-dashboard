import { describe, expect, it } from 'vitest'
import { describeFilter } from './describeFilter.ts'

const plain = (parts: string[]) => parts.map((part) => part.replace(/ /g, ' '))

describe('describeFilter', () => {
  it('описывает все условия фильтра по-русски', () => {
    expect(
      plain(
        describeFilter({
          levels: [3, 2],
          nameContains: 'альфа',
          ancestorName: 'Продаж',
          metrics: [
            { field: 'totalBudget', op: 'gt', value: 10_000_000 },
            { field: 'avgPerformance', op: 'lte', value: 72.5 },
            { field: 'headcount', op: 'gte', value: 1000 },
          ],
          sort: { key: 'totalBudget', dir: 'desc' },
          limit: 5,
        }),
      ),
    ).toEqual([
      'Отделы, Команды',
      'Название содержит «альфа»',
      'Входит в «Продаж»',
      'Бюджет суммарный > 10 000 000 руб.',
      'Средняя эффективность ≤ 72,5',
      'Сотрудников в самом подразделении ≥ 1 000',
      'Сортировка по бюджету ↓',
      'Первые 5',
    ])
  })

  it('пустой фильтр — без условий', () => {
    expect(describeFilter({})).toEqual([])
  })
})
