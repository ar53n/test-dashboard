import styled from 'styled-components'

export const StaleBanner = styled.div`
  padding: ${({ theme }) => `${theme.space(2)} ${theme.space(4)}`};
  background: ${({ theme }) => theme.color.dangerSurface};
  color: ${({ theme }) => theme.color.danger};
  font-size: ${({ theme }) => theme.font.size.sm};
`

export const InlineButton = styled.button`
  margin-left: ${({ theme }) => theme.space(2)};
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
`
