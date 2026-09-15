import type { ReactNode } from 'react'
import styled, { keyframes } from 'styled-components'
import { FLASH_DURATION_MS, flashHost, useChangeCount } from './flash.ts'

const fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`

/**
 * Подсветка поверх содержимого, исчезающая за 1,5 с. Анимируется только `opacity`
 * (без движения), поэтому при `prefers-reduced-motion` подсветка сохраняется.
 * Родитель должен включать стили `flashHost`.
 */
export const FlashOverlay = styled.span`
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: ${({ theme }) => theme.color.flash};
  pointer-events: none;
  animation: ${fadeOut} ${FLASH_DURATION_MS}ms ease-out forwards;
`

const InlineHost = styled.span`
  ${flashHost};
  display: inline-flex;
  align-items: center;
  margin: -1px -4px;
  padding: 1px 4px;
  border-radius: ${({ theme }) => theme.radius.sm};
`

/** Строчная обёртка: подсвечивает `children`, когда меняется `value`. */
export function Flash({ value, children }: { value: unknown; children: ReactNode }) {
  const count = useChangeCount(value)
  return (
    <InlineHost>
      {count > 0 && <FlashOverlay key={count} aria-hidden="true" />}
      {children}
    </InlineHost>
  )
}
