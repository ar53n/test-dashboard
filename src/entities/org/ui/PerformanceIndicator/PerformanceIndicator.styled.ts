import styled from 'styled-components'
import type { PerformanceLevel } from '@/entities/org/model/performance.ts'

export const Wrapper = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.space(1.5)};
  min-width: 3.25em;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.color.textMuted};
`

export const Dot = styled.span<{ $level: PerformanceLevel | 'none' }>`
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 50%;
  background: ${({ theme, $level }) => ($level === 'none' ? theme.color.border : theme.color.performance[$level])};
`
