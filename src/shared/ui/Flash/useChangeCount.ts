import { useState } from 'react'

/**
 * Номер изменения значения: 0 на первом рендере, +1 при каждом изменении.
 * Состояние обновляется во время рендера (паттерн «предыдущее значение»), без эффекта
 * и лишнего кадра. Сравниваются показанные значения, поэтому изменение в невидимом
 * знаке после запятой не подсвечивается.
 */
export function useChangeCount(value: unknown): number {
  const [previous, setPrevious] = useState(value)
  const [count, setCount] = useState(0)
  if (!Object.is(previous, value)) {
    setPrevious(value)
    setCount(count + 1)
  }
  return count
}
