import styled from 'styled-components'

export const Button = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space(2)};
  padding: ${({ theme }) => `${theme.space(2)} ${theme.space(4)}`};
  border: 1px solid ${({ theme }) => theme.color.accent};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.accent};
  color: ${({ theme }) => theme.color.accentText};
  font-weight: 500;
  cursor: pointer;

  &:hover {
    filter: brightness(1.08);
  }
`
