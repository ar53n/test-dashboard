import { useCallback, useState } from 'react'
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue.ts'
import type { SortDirection, SortKey, SortState } from './model/rows.ts'

export const SEARCH_DEBOUNCE_MS = 250

/**
 * Состояние таблицы: поиск и сортировка. Хранится выше таблицы, поэтому
 * переживает переключение вкладок на узком экране.
 */
export function useOrgTableState() {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState | null>(null)
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)

  // Очистка поля применяется сразу: ждать 250 мс, чтобы вернуть все строки, незачем.
  const appliedSearch = search.trim() === '' ? '' : debouncedSearch

  const sortBy = useCallback((key: SortKey, direction: SortDirection) => setSort({ key, direction }), [])

  return { search, setSearch, appliedSearch, sort, sortBy }
}

export type OrgTableState = ReturnType<typeof useOrgTableState>
