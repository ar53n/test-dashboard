import { describe, expect, it } from 'vitest'
import { formatBudget, formatDecimal, formatInteger } from './format.ts'

const withPlainSpaces = (value: string) => value.replace(/\u00a0/g, ' ')

describe('formatBudget', () => {
  it('форматирует как «12 345 678 руб.»', () => {
    expect(withPlainSpaces(formatBudget(12_345_678))).toBe('12 345 678 руб.')
  })

  it('использует неразрывные пробелы, чтобы сумма не переносилась по разрядам', () => {
    expect(formatBudget(12_345_678)).toBe('12\u00a0345\u00a0678\u00a0руб.')
  })

  it('округляет дробные суммы и корректно показывает ноль', () => {
    expect(withPlainSpaces(formatBudget(999_999.6))).toBe('1 000 000 руб.')
    expect(withPlainSpaces(formatBudget(0))).toBe('0 руб.')
  })
})

describe('formatInteger / formatDecimal', () => {
  it('разделяет разряды и показывает один знак после запятой', () => {
    expect(withPlainSpaces(formatInteger(15_300))).toBe('15 300')
    expect(formatDecimal(72.44)).toBe('72,4')
    expect(formatDecimal(80)).toBe('80,0')
  })
})
