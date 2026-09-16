import { formatEtag, ORG_EPOCH_HEADER, ORG_REVISION_HEADER, type OrgVersion } from '@shared/contract.ts'
import {
  queryOptions,
  useQuery,
  type QueryClient,
  type QueryFunctionContext,
} from '@tanstack/react-query'
import { OrgStructureError } from '@/entities/org/model/buildIndex.ts'
import { compareVersions, createOrgModel, pickCurrentModel, type OrgModel } from '@/entities/org/model/orgModel.ts'
import { formatIssues, orgTreeResponseSchema } from '@/entities/org/model/schema.ts'
import { ApiError, apiUrl, getScenario, httpError, isRetryableError, readJson, request } from '@/shared/api/http.ts'

export const ORG_TREE_STALE_TIME_MS = 5_000
const MAX_RETRIES = 2

export const orgTreeQueryKey = (scenario: string | null = getScenario()) => ['org-tree', { scenario }] as const
type OrgTreeQueryKey = ReturnType<typeof orgTreeQueryKey>

function readVersion(headers: Headers): OrgVersion | null {
  const epoch = headers.get(ORG_EPOCH_HEADER)
  const revision = Number(headers.get(ORG_REVISION_HEADER))
  return epoch && Number.isInteger(revision) ? { epoch, revision } : null
}

/**
 * Условный запрос снимка. Версия текущей модели уходит в `If-None-Match`;
 * на 304 и на ответ с той же или более старой ревизией возвращается модель из кэша —
 * без разбора JSON, валидации и повторной агрегации.
 */
export async function fetchOrgModel({ client, queryKey, signal }: QueryFunctionContext<OrgTreeQueryKey>): Promise<OrgModel> {
  const current = client.getQueryData<OrgModel>(queryKey)
  const headers = new Headers({ Accept: 'application/json' })
  if (current?.version) headers.set('If-None-Match', formatEtag(current.version.epoch, current.version.revision))

  // `no-store`: HTTP-кэш браузера не подменяет 304 на 200, условными запросами управляем сами.
  const response = await request(apiUrl('/api/org-tree'), { signal, cache: 'no-store', headers })

  if (response.status === 304 && current) return current
  if (!response.ok) throw httpError(response)

  const version = readVersion(response.headers)
  if (current) {
    const order = compareVersions(version, current.version)
    if (order === 'same' || order === 'older') {
      // Тело не нужно; сбой при закрытии потока не делает запрос неудачным.
      await response.body?.cancel().catch(() => {})
      return current
    }
  }

  const parsed = orgTreeResponseSchema.safeParse(await readJson(response, signal))
  if (!parsed.success) {
    throw new ApiError('validation', 'Ответ сервера не соответствует схеме', { details: formatIssues(parsed.error) })
  }

  try {
    return createOrgModel(parsed.data, version)
  } catch (error) {
    if (error instanceof OrgStructureError) {
      throw new ApiError('validation', 'Некорректная структура дерева', { details: [error.message], cause: error })
    }
    throw error
  }
}

/**
 * Запросы, данные которых сейчас поддерживаются push-обновлениями. Пока запрос в множестве,
 * данные не устаревают: фокус окна, reconnect и новый наблюдатель не делают HTTP-запрос.
 * `WeakSet` по объекту запроса: у каждого QueryClient свой запрос, а удалённый из кэша
 * запрос сам выпадает из множества и по умолчанию снова устаревает через 5 с.
 */
const pushedQueries = new WeakSet<object>()

export function setOrgTreePushed(client: QueryClient, pushed: boolean) {
  const query = client.getQueryCache().find({ queryKey: orgTreeQueryKey(), exact: true })
  if (!query) return
  if (pushed) pushedQueries.add(query)
  else pushedQueries.delete(query)
}

export const orgTreeQueryOptions = () =>
  queryOptions({
    queryKey: orgTreeQueryKey(),
    queryFn: fetchOrgModel,
    staleTime: (query) => (pushedQueries.has(query) ? Infinity : ORG_TREE_STALE_TIME_MS),
    retry: (failureCount, error) => failureCount < MAX_RETRIES && isRetryableError(error),
    // Модель содержит Map, поэтому стандартное структурное сравнение не подходит — сравниваем версии.
    structuralSharing: (oldData, newData) => pickCurrentModel(oldData as OrgModel | undefined, newData as OrgModel),
  })

export const useOrgModel = () => useQuery(orgTreeQueryOptions())
