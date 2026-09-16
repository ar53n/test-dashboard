import styled from 'styled-components'
import { COLLAPSE_DURATION_MS } from './constants.ts'

export const Root = styled.div<{ $height: number | null }>`
  height: ${({ $height }) => ($height === null ? 'auto' : `${$height}px`)};
  overflow: ${({ $height }) => ($height === null ? 'visible' : 'hidden')};
  transition: height ${COLLAPSE_DURATION_MS}ms ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`
