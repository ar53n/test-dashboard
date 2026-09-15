const NBSP = '\u00a0'

const integerFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const decimalFormat = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Целое число с разделением разрядов неразрывными пробелами: `12 345`. */
export function formatInteger(value: number): string {
  return integerFormat.format(value)
}

/** Бюджет в рублях: `12 345 678 руб.`. Копейки отбрасываются округлением. */
export function formatBudget(value: number): string {
  return `${integerFormat.format(Math.round(value))}${NBSP}руб.`
}

/** Число с одним знаком после запятой: `72,4`. */
export function formatDecimal(value: number): string {
  return decimalFormat.format(value)
}
