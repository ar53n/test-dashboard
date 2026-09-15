import type { OrgFilter } from '@shared/orgFilter.ts'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue.ts'
import { aiSearchQueryOptions, AiSearchError, normalizeAiQuery, type AiSearchFailure } from './ai/aiSearchQuery.ts'
import { filterSort, isEmptyFilter } from './model/applyOrgFilter.ts'
import type { SortDirection, SortKey, SortState } from './model/rows.ts'

export const SEARCH_DEBOUNCE_MS = 250

export type AiSearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'applied'; filter: OrgFilter }
  /** AI не помог — работает текстовый поиск; `empty` — модель не нашла условий в запросе. */
  | { status: 'fallback'; reason: AiSearchFailure | 'empty' }

/**
 * Состояние таблицы: поиск (текстовый и AI) и сортировка. Хранится выше таблицы, поэтому
 * переживает переключение вкладок на узком экране, а идущий AI-запрос не отменяется.
 *
 * - Ввод фильтрует по названию в реальном времени (debounce 250 мс).
 * - Enter или кнопка «AI» отправляют текущий ввод в AI-поиск. Успешный фильтр заменяет
 *   текстовый поиск: иначе фраза «команды с бюджетом выше миллиона» искалась бы как подстрока.
 * - Любое изменение ввода снимает AI-фильтр, и снова работает текстовый поиск.
 * - Повторная отправка того же ввода: после успеха — из кэша, после сбоя — новый запрос.
 */
export function useOrgTableState() {
  const [search, setSearchValue] = useState('')
  const [sort, setSort] = useState<SortState | null>(null)
  const [aiQuery, setAiQuery] = useState<string | null>(null)
  /** Пользователь выбрал сортировку сам после ответа AI — она важнее сортировки из фильтра. */
  const [aiSortOverridden, setAiSortOverridden] = useState(false)
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)

  const ai = useQuery(aiSearchQueryOptions(aiQuery))

  const setSearch = useCallback((value: string) => {
    setSearchValue(value)
    setAiQuery((submitted) => (submitted !== null && normalizeAiQuery(value) !== submitted ? null : submitted))
  }, [])

  const { isError: aiFailed, refetch: refetchAi } = ai
  const submitAiSearch = useCallback(() => {
    const normalized = normalizeAiQuery(search)
    if (!normalized) return
    setAiSortOverridden(false)
    // Тот же ключ не запускает запрос сам. Успешный результат берётся из кэша,
    // а после сбоя (сеть, таймаут провайдера) явная повторная отправка должна спросить снова.
    if (normalized === aiQuery && aiFailed) {
      void refetchAi()
      return
    }
    setAiQuery(normalized)
  }, [search, aiQuery, aiFailed, refetchAi])

  const resetSearch = useCallback(() => {
    setSearchValue('')
    setAiQuery(null)
  }, [])

  const sortBy = useCallback((key: SortKey, direction: SortDirection) => {
    setSort({ key, direction })
    setAiSortOverridden(true)
  }, [])

  let aiState: AiSearchState = { status: 'idle' }
  if (aiQuery !== null) {
    if (ai.isPending) aiState = { status: 'loading' }
    else if (ai.isError) {
      aiState = { status: 'fallback', reason: ai.error instanceof AiSearchError ? ai.error.reason : 'failed' }
    } else if (isEmptyFilter(ai.data)) aiState = { status: 'fallback', reason: 'empty' }
    else aiState = { status: 'applied', filter: ai.data }
  }

  const aiFilter = aiState.status === 'applied' ? aiState.filter : null
  const aiSort = aiFilter && !aiSortOverridden ? filterSort(aiFilter) : null

  // Очистка поля применяется сразу: ждать 250 мс, чтобы вернуть все строки, незачем.
  const textSearch = search.trim() === '' ? '' : debouncedSearch

  return {
    search,
    setSearch,
    /** Текстовый поиск; при применённом AI-фильтре не используется. */
    appliedSearch: aiFilter ? '' : textSearch,
    aiState,
    aiFilter,
    submitAiSearch,
    resetSearch,
    sort: aiSort ?? sort,
    sortBy,
  }
}

export type OrgTableState = ReturnType<typeof useOrgTableState>
