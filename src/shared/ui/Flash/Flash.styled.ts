import styled, { css, keyframes } from 'styled-components'
import { FLASH_DURATION_MS } from './constants.ts'

/** Хост подсветки: свой контекст наложения, подсветка ложится над фоном хоста, но под текстом. */
export const flashHost = css`
  position: relative;
  isolation: isolate;
`

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

export const InlineHost = styled.span`
  ${flashHost};
  display: inline-flex;
  align-items: center;
  margin: -1px -4px;
  padding: 1px 4px;
  border-radius: ${({ theme }) => theme.radius.sm};
`
