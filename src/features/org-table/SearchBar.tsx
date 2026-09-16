import { useId, type FormEvent, type ReactNode } from 'react'
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden/index.ts'
import { describeFilter } from './ai/describeFilter.ts'
import * as S from './SearchBar.styled.ts'
import type { OrgTableState } from './useOrgTableState.ts'

const FALLBACK_HINTS = {
  unavailable: 'AI-поиск не настроен на сервере — показан поиск по названию.',
  rate_limited: 'Слишком много AI-запросов, попробуйте позже — показан поиск по названию.',
  failed: 'AI-поиск не ответил — показан поиск по названию.',
  invalid: 'AI вернул некорректный фильтр — показан поиск по названию.',
  empty: 'AI не нашёл условий в запросе — показан поиск по названию.',
} as const

interface SearchBarProps {
  state: Pick<OrgTableState, 'search' | 'setSearch' | 'aiState' | 'submitAiSearch' | 'resetSearch'>
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
      <S.Form role="search" onSubmit={handleSubmit}>
        <VisuallyHidden as="label" htmlFor={inputId}>
          Поиск по названию подразделения
        </VisuallyHidden>
        <S.SearchInput
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
        <S.AiButton type="submit" disabled={search.trim() === '' || loading} aria-busy={loading}>
          {loading ? 'AI…' : 'AI'}
        </S.AiButton>
      </S.Form>
      {counter}

      {aiState.status !== 'idle' && (
        <S.StatusRow role="status">
          {aiState.status === 'loading' && <span>AI разбирает запрос…</span>}
          {aiState.status === 'fallback' && <span>{FALLBACK_HINTS[aiState.reason]}</span>}
          {aiState.status === 'applied' && (
            <>
              <span>AI-фильтр:</span>
              <S.Chips>
                {describeFilter(aiState.filter).map((part) => (
                  <S.Chip key={part}>{part}</S.Chip>
                ))}
              </S.Chips>
              <S.LinkButton type="button" onClick={resetSearch}>
                Сбросить
              </S.LinkButton>
            </>
          )}
        </S.StatusRow>
      )}
    </>
  )
}
