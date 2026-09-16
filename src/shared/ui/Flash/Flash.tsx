import type { ReactNode } from 'react'
import * as S from './Flash.styled.ts'
import { useChangeCount } from './useChangeCount.ts'

/** Строчная обёртка: подсвечивает `children`, когда меняется `value`. */
export function Flash({ value, children }: { value: unknown; children: ReactNode }) {
  const count = useChangeCount(value)
  return (
    <S.InlineHost>
      {count > 0 && <S.FlashOverlay key={count} aria-hidden="true" />}
      {children}
    </S.InlineHost>
  )
}
