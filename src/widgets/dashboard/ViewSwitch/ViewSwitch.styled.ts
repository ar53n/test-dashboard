import styled from 'styled-components'
import { media } from '@/shared/ui/media.ts'

export const Group = styled.div`
  display: inline-flex;
  padding: ${({ theme }) => theme.space(0.5)};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.surface};
`

export const Option = styled.button`
  padding: ${({ theme }) => `${theme.space(1.5)} ${theme.space(4)}`};
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: ${({ theme }) => theme.color.textMuted};
  font-weight: 500;
  cursor: pointer;

  @media ${media.narrow} {
    padding-inline: ${({ theme }) => theme.space(3)};
  }

  &:hover {
    color: ${({ theme }) => theme.color.text};
  }

  &[aria-pressed='true'] {
    background: ${({ theme }) => theme.color.accent};
    color: ${({ theme }) => theme.color.accentText};
  }
`
