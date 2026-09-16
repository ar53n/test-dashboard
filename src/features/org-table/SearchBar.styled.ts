import styled from 'styled-components'

export const Form = styled.form`
  display: flex;
  flex: 1 1 320px;
  gap: ${({ theme }) => theme.space(2)};
  max-width: 480px;
`

export const SearchInput = styled.input`
  flex: 1;
  min-width: 0;
  padding: ${({ theme }) => `${theme.space(2)} ${theme.space(3)}`};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.surface};
  color: inherit;
  font: inherit;

  &::placeholder {
    color: ${({ theme }) => theme.color.textMuted};
  }

  &:focus-visible {
    outline-offset: 0;
    border-color: ${({ theme }) => theme.color.focus};
  }
`

export const AiButton = styled.button`
  flex-shrink: 0;
  padding: ${({ theme }) => `${theme.space(2)} ${theme.space(3)}`};
  border: 1px solid ${({ theme }) => theme.color.accent};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.surface};
  color: ${({ theme }) => theme.color.accent};
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.color.surfaceSelected};
  }

  &:disabled {
    border-color: ${({ theme }) => theme.color.border};
    color: ${({ theme }) => theme.color.textMuted};
    cursor: default;
  }
`

export const StatusRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.space(2)};
  flex-basis: 100%;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.color.textMuted};
`

export const Chips = styled.ul`
  display: contents;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Chip = styled.li`
  padding: ${({ theme }) => `${theme.space(0.5)} ${theme.space(2)}`};
  border-radius: 999px;
  background: ${({ theme }) => theme.color.surfaceSelected};
  color: ${({ theme }) => theme.color.text};
  white-space: nowrap;
`

export const LinkButton = styled.button`
  padding: 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.color.accent};
  font-size: inherit;
  font-weight: 600;
  cursor: pointer;
`
