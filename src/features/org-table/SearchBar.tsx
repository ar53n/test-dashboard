import { useId, type FormEvent, type ReactNode } from 'react'
import styled from 'styled-components'
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden.ts'
import { describeFilter } from './ai/describeFilter.ts'
import type { OrgTableState } from './useOrgTableState.ts'

const Form = styled.form`
  display: flex;
  flex: 1 1 320px;
  gap: ${({ theme }) => theme.space(2)};
  max-width: 480px;
`

const SearchInput = styled.input`
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

const AiButton = styled.button`
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

const StatusRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.space(2)};
  flex-basis: 100%;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.color.textMuted};
`

const Chips = styled.ul`
  display: contents;
  margin: 0;
  padding: 0;
  list-style: none;
`

const Chip = styled.li`
  padding: ${({ theme }) => `${theme.space(0.5)} ${theme.space(2)}`};
  border-radius: 999px;
  background: ${({ theme }) => theme.color.surfaceSelected};
  color: ${({ theme }) => theme.color.text};
  white-space: nowrap;
`

const LinkButton = styled.button`
  padding: 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.color.accent};
  font-size: inherit;
  font-weight: 600;
  cursor: pointer;
`

const FALLBACK_HINTS = {
  unavailable: 'AI-поиск не настроен на сервере — показан поиск по названию.',
  rate_limited: 'Слишком много AI-запросов, попробуйте позже — показан поиск по названию.',
  failed: 'AI-поиск не ответил — показан поиск по названию.',
  invalid: 'AI вернул некорректный фильтр — показан поиск по названию.',
  empty: 'AI не нашёл условий в запросе — показан поиск по названию.',
} as const

interface SearchBarProps {
  state: OrgTableState
  /** Счётчик строк справа от поля. */
  counter: ReactNode
}

export function SearchBar({ state, counter }: SearchBarProps) {
  const { search, setSearch, aiState, submitAiSearch, resetSearch } = state
  const inputId = useId()
  const hintId = useId()
  const loading = aiState.status === 'loading'

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    submitAiSearch()
  }

  return (
    <>
      <Form role="search" onSubmit={handleSubmit}>
        <VisuallyHidden as="label" htmlFor={inputId}>
          Поиск по названию подразделения
        </VisuallyHidden>
        <SearchInput
          id={inputId}
          type="search"
          placeholder="Название или запрос для AI…"
          autoComplete="off"
          aria-describedby={hintId}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <VisuallyHidden id={hintId}>
          Ввод ищет по названию. Enter или кнопка «AI» разбирают запрос на естественном языке.
        </VisuallyHidden>
        <AiButton type="submit" disabled={search.trim() === '' || loading} aria-busy={loading}>
          {loading ? 'AI…' : 'AI'}
        </AiButton>
      </Form>
      {counter}

      {aiState.status !== 'idle' && (
        <StatusRow role="status">
          {aiState.status === 'loading' && <span>AI разбирает запрос…</span>}
          {aiState.status === 'fallback' && <span>{FALLBACK_HINTS[aiState.reason]}</span>}
          {aiState.status === 'applied' && (
            <>
              <span>AI-фильтр:</span>
              <Chips>
                {describeFilter(aiState.filter).map((part) => (
                  <Chip key={part}>{part}</Chip>
                ))}
              </Chips>
              <LinkButton type="button" onClick={resetSearch}>
                Сбросить
              </LinkButton>
            </>
          )}
        </StatusRow>
      )}
    </>
  )
}
