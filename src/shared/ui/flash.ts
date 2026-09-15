import { useState } from 'react'
import { css } from 'styled-components'

export const FLASH_DURATION_MS = 1500

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

/** Хост подсветки: свой контекст наложения, подсветка ложится над фоном хоста, но под текстом. */
export const flashHost = css`
  position: relative;
  isolation: isolate;
`
