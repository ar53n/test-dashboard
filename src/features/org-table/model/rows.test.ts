import { describe, expect, it } from 'vitest'
import { createOrgModel } from '@/entities/org/model/orgModel.ts'
import { makeNode } from '@/entities/org/model/testUtils.ts'
import { buildRows, filterRows, normalizeSearch, sortRows, type OrgTableRow } from './rows.ts'

const model = createOrgModel(
  [
    makeNode('div-b', null, { name: 'Продажи', headcount: 2, budget: 3_000_000, performance: 80 }),
    makeNode('div-a', null, { name: 'Технологии', headcount: 1, budget: 1_000_000, performance: 60 }),
    makeNode('dep-a1', 'div-a', { name: 'Платформа', headcount: 3, budget: 2_000_000, performance: 90 }),
    makeNode('team-a1', 'dep-a1', { name: 'Платформа: команда «Альфа»', headcount: 10, budget: 500_000, performance: 70 }),
    makeNode('dep-b1', 'div-b', { name: 'Партнёрская сеть', headcount: 0, budget: 100_000, performance: 10 }),
    makeNode('dep-a2', 'div-a', { name: 'Ёлочные  игрушки', headcount: 5, budget: 2_000_000, performance: 50 }),
  ],
  null,
)
const rows = buildRows(model)
const ids = (list: readonly OrgTableRow[]) => list.map((row) => row.id)

describe('buildRows', () => {
  it('идёт в порядке дерева: родитель, затем его поддерево', () => {
    expect(ids(rows)).toEqual(['div-b', 'dep-b1', 'div-a', 'dep-a1', 'team-a1', 'dep-a2'])
  })

  it('берёт суммарные показатели и уровень из модели', () => {
    const division = rows.find((row) => row.id === 'div-a')!
    expect(division).toMatchObject({ level: 1, totalHeadcount: 19, totalBudget: 5_500_000 })
    expect(division.avgPerformance).toBeCloseTo((60 + 270 + 700 + 250) / 19, 10)
    expect(rows.find((row) => row.id === 'team-a1')!.level).toBe(3)
    expect(rows.find((row) => row.id === 'dep-b1')!.avgPerformance).toBeNull()
  })

  it('переиспользует агрегаты модели, а не пересчитывает их', () => {
    const aggregate = model.aggregates.get('dep-a1')!
    expect(rows.find((row) => row.id === 'dep-a1')!.totalBudget).toBe(aggregate.totalBudget)
  })
})

describe('sortRows', () => {
  it('без сортировки возвращает исходный массив', () => {
    expect(sortRows(rows, null)).toBe(rows)
  })

  it('сортирует числа в обе стороны и не мутирует исходные строки', () => {
    const before = ids(rows)
    expect(ids(sortRows(rows, { key: 'totalBudget', direction: 'asc' }))).toEqual([
      'dep-b1', 'team-a1', 'dep-a2', 'dep-a1', 'div-b', 'div-a',
    ])
    expect(ids(sortRows(rows, { key: 'totalHeadcount', direction: 'desc' }))).toEqual([
      'div-a', 'dep-a1', 'team-a1', 'dep-a2', 'div-b', 'dep-b1',
    ])
    expect(ids(rows)).toEqual(before)
  })

  it('при равных значениях сохраняет порядок дерева', () => {
    expect(ids(sortRows(rows, { key: 'level', direction: 'asc' }))).toEqual([
      'div-b', 'div-a', 'dep-b1', 'dep-a1', 'dep-a2', 'team-a1',
    ])
    expect(ids(sortRows(rows, { key: 'level', direction: 'desc' }))).toEqual([
      'team-a1', 'dep-b1', 'dep-a1', 'dep-a2', 'div-b', 'div-a',
    ])
  })

  it('названия сравнивает по правилам русского алфавита, «Ё» рядом с «Е»', () => {
    expect(ids(sortRows(rows, { key: 'name', direction: 'asc' }))).toEqual([
      'dep-a2', 'dep-b1', 'dep-a1', 'team-a1', 'div-b', 'div-a',
    ])
  })

  it('узлы без эффективности всегда в конце — и по возрастанию, и по убыванию', () => {
    const asc = ids(sortRows(rows, { key: 'avgPerformance', direction: 'asc' }))
    const desc = ids(sortRows(rows, { key: 'avgPerformance', direction: 'desc' }))
    expect(asc.at(-1)).toBe('dep-b1')
    expect(desc.at(-1)).toBe('dep-b1')
    expect(desc[0]).toBe('div-b')
  })
})

describe('filterRows', () => {
  it('ищет подстроку без учёта регистра и сохраняет порядок', () => {
    expect(ids(filterRows(rows, 'ПЛАТФОРМА'))).toEqual(['dep-a1', 'team-a1'])
  })

  it('не различает «е» и «ё», игнорирует лишние пробелы', () => {
    expect(ids(filterRows(rows, '  елочные игрушки '))).toEqual(['dep-a2'])
    expect(ids(filterRows(rows, 'партнерская'))).toEqual(['dep-b1'])
  })

  it('пустой запрос возвращает все строки, отсутствие совпадений — пустой список', () => {
    expect(filterRows(rows, '   ')).toBe(rows)
    expect(filterRows(rows, 'бухгалтерия')).toEqual([])
  })

  it('normalizeSearch', () => {
    expect(normalizeSearch('  Ёж   И  ЕЖИХА ')).toBe('еж и ежиха')
  })
})
