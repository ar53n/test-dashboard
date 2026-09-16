import styled, { keyframes } from 'styled-components'

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
`

export const SkeletonList = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space(2)};
  padding: ${({ theme }) => theme.space(4)};
`

export const SkeletonRow = styled.div<{ $indent: number; $width: number }>`
  height: 20px;
  margin-left: ${({ $indent }) => $indent * 20}px;
  width: ${({ $width }) => $width}%;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.skeleton};
  animation: ${pulse} 1.4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export const Message = styled.div<{ $tone: 'neutral' | 'danger' }>`
  display: grid;
  justify-items: start;
  gap: ${({ theme }) => theme.space(2)};
  margin: ${({ theme }) => theme.space(4)};
  padding: ${({ theme }) => theme.space(5)};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme, $tone }) => ($tone === 'danger' ? theme.color.dangerSurface : theme.color.background)};
`

export const Title = styled.p<{ $tone: 'neutral' | 'danger' }>`
  margin: 0;
  font-weight: 600;
  color: ${({ theme, $tone }) => ($tone === 'danger' ? theme.color.danger : theme.color.text)};
`

export const Description = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.color.textMuted};
`

export const Details = styled.ul`
  margin: 0;
  padding-left: ${({ theme }) => theme.space(5)};
  color: ${({ theme }) => theme.color.textMuted};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
`
