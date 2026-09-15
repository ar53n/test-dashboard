import { orgFilterSchema, type OrgFilter } from '@shared/orgFilter.ts'
import { queryOptions, skipToken } from '@tanstack/react-query'
import { z } from 'zod'
import { readJson, request } from '@/shared/api/http.ts'

/** Повтор того же запроса в течение 30 минут после последнего использования берётся из кэша. */
export const AI_SEARCH_GC_TIME_MS = 30 * 60 * 1000

export type AiSearchFailure = 'unavailable' | 'rate_limited' | 'failed' | 'invalid'

export class AiSearchError extends Error {
  readonly reason: AiSearchFailure

  constructor(reason: AiSearchFailure, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'AiSearchError'
    this.reason = reason
  }
}

const responseSchema = z.object({ filter: orgFilterSchema })

/** Нормализация для ключа кэша: регистр и пробелы не делают запрос «новым». */
export function normalizeAiQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru')
}

export async function fetchAiFilter(query: string, signal: AbortSignal): Promise<OrgFilter> {
  let response: Response
  try {
    response = await request('/api/ai-search', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query }),
    })
  } catch (error) {
    if (signal.aborted) throw error
    throw new AiSearchError('failed', 'AI-поиск недоступен', { cause: error })
  }

  if (response.status === 503) throw new AiSearchError('unavailable', 'AI-поиск не настроен')
  if (response.status === 429) throw new AiSearchError('rate_limited', 'Превышен лимит AI-запросов')
  if (!response.ok) throw new AiSearchError('failed', `AI-поиск ответил ошибкой ${response.status}`)

  let json: unknown
  try {
    json = await readJson(response, signal)
  } catch (error) {
    if (signal.aborted) throw error
    throw new AiSearchError('invalid', 'Некорректный ответ AI-поиска', { cause: error })
  }
  const parsed = responseSchema.safeParse(json)
  if (!parsed.success) throw new AiSearchError('invalid', 'AI-поиск вернул фильтр не по контракту')
  return parsed.data.filter
}

/**
 * `null` — запрос не отправлен (`skipToken`). Смена ключа отписывает наблюдателя от прежнего
 * запроса, и TanStack Query отменяет его через `signal`; запоздавший ответ ложится в свой ключ
 * и на экран не попадает.
 */
export const aiSearchQueryOptions = (normalizedQuery: string | null) =>
  queryOptions({
    queryKey: ['ai-search', normalizedQuery] as const,
    queryFn: normalizedQuery === null ? skipToken : ({ signal }) => fetchAiFilter(normalizedQuery, signal),
    staleTime: Infinity,
    gcTime: AI_SEARCH_GC_TIME_MS,
    // Ответ модели от повтора не станет лучше, а 503 означает «не настроено».
    retry: false,
  })
