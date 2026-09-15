// @vitest-environment jsdom
import { ORG_EPOCH_HEADER, ORG_REVISION_HEADER } from '@shared/contract.ts'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeAggregates } from '@/entities/org/model/aggregate.ts'
import { makeNode } from '@/entities/org/model/testUtils.ts'
import { ApiError, readJson } from '@/shared/api/http.ts'
import { orgTreeQueryKey, orgTreeQueryOptions } from './orgTreeQuery.ts'

vi.mock('@/entities/org/model/aggregate.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/entities/org/model/aggregate.ts')>()
  return { ...original, computeAggregates: vi.fn(original.computeAggregates) }
})

const nodes = [makeNode('div', null), makeNode('dep', 'div')]

function snapshotResponse(body: unknown, revision = 1, epoch = 'epoch-1') {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', [ORG_EPOCH_HEADER]: epoch, [ORG_REVISION_HEADER]: String(revision) },
  })
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(computeAggregates).mockClear()
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

const createClient = () => new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })

describe('orgTreeQuery: отмена и дедупликация', () => {
  it('два потребителя делят один запрос; запрос отменяется только когда размонтированы все', async () => {
    let signal: AbortSignal | undefined
    fetchMock.mockImplementation((_url, init) => {
      signal = init!.signal!
      return new Promise((_, reject) => {
        signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })

    const client = createClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    const tree = renderHook(() => useQuery(orgTreeQueryOptions()), { wrapper })
    const table = renderHook(() => useQuery(orgTreeQueryOptions()), { wrapper })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    tree.unmount()
    expect(signal!.aborted).toBe(false)

    table.unmount()
    await waitFor(() => expect(signal!.aborted).toBe(true))
  })
})

describe('orgTreeQuery: условные запросы', () => {
  it('на 304 возвращает ту же модель без повторной агрегации', async () => {
    const client = createClient()
    fetchMock.mockResolvedValueOnce(snapshotResponse(nodes, 7))
    const first = await client.fetchQuery(orgTreeQueryOptions())
    expect(computeAggregates).toHaveBeenCalledTimes(1)

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }))
    await client.refetchQueries({ queryKey: orgTreeQueryKey() })

    const [, init] = fetchMock.mock.calls[1]
    expect(new Headers(init!.headers).get('If-None-Match')).toBe('"epoch-1-7"')
    expect(init!.cache).toBe('no-store')
    expect(client.getQueryData(orgTreeQueryOptions().queryKey)).toBe(first)
    expect(computeAggregates).toHaveBeenCalledTimes(1)
  })

  it('на 200 с той же или более старой ревизией не разбирает тело', async () => {
    const client = createClient()
    fetchMock.mockResolvedValueOnce(snapshotResponse(nodes, 7))
    const first = await client.fetchQuery(orgTreeQueryOptions())

    const stale = snapshotResponse(nodes, 6)
    const jsonSpy = vi.spyOn(stale, 'json')
    fetchMock.mockResolvedValueOnce(stale)
    await client.refetchQueries({ queryKey: orgTreeQueryKey() })

    expect(jsonSpy).not.toHaveBeenCalled()
    expect(client.getQueryData(orgTreeQueryOptions().queryKey)).toBe(first)
    expect(computeAggregates).toHaveBeenCalledTimes(1)
  })

  it('после рестарта сервера (другой epoch, тот же номер ревизии) строит новую модель', async () => {
    const client = createClient()
    fetchMock.mockResolvedValueOnce(snapshotResponse(nodes, 7, 'epoch-1'))
    const first = await client.fetchQuery(orgTreeQueryOptions())

    fetchMock.mockResolvedValueOnce(snapshotResponse(nodes, 7, 'epoch-2'))
    await client.refetchQueries({ queryKey: orgTreeQueryKey() })

    const next = client.getQueryData(orgTreeQueryOptions().queryKey)
    expect(next).not.toBe(first)
    expect(next?.version).toEqual({ epoch: 'epoch-2', revision: 7 })
  })
})

describe('orgTreeQuery: ошибки', () => {
  it('невалидный ответ — ошибка валидации без повторных попыток', async () => {
    const client = createClient()
    fetchMock.mockResolvedValue(snapshotResponse([{ id: 1, performance: 500 }]))

    const error = await client.fetchQuery(orgTreeQueryOptions()).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).kind).toBe('validation')
    expect((error as ApiError).details.length).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('битая иерархия — ошибка валидации', async () => {
    const client = createClient()
    fetchMock.mockResolvedValue(snapshotResponse([makeNode('a', 'ghost')]))

    const error = await client.fetchQuery(orgTreeQueryOptions()).catch((e: unknown) => e)
    expect((error as ApiError).kind).toBe('validation')
  })

  it('обрыв соединения при чтении тела — сетевая ошибка с повторами', async () => {
    const client = createClient()
    fetchMock.mockImplementation(async () => {
      const response = snapshotResponse(nodes)
      vi.spyOn(response, 'text').mockRejectedValue(new TypeError('network error'))
      return response
    })

    const error = await client.fetchQuery(orgTreeQueryOptions()).catch((e: unknown) => e)
    expect((error as ApiError).kind).toBe('network')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('отмена во время чтения тела не превращается в ApiError', async () => {
    const controller = new AbortController()
    const response = snapshotResponse(nodes)
    vi.spyOn(response, 'text').mockImplementation(() => {
      controller.abort()
      return Promise.reject(new DOMException('Aborted', 'AbortError'))
    })

    const error = await readJson(response, controller.signal).catch((e: unknown) => e)
    expect(error).not.toBeInstanceOf(ApiError)
    expect((error as DOMException).name).toBe('AbortError')
  })

  it('синтаксически неверный JSON — ошибка валидации без повторов', async () => {
    const client = createClient()
    fetchMock.mockImplementation(async () => new Response('{не json', { status: 200 }))

    const error = await client.fetchQuery(orgTreeQueryOptions()).catch((e: unknown) => e)
    expect((error as ApiError).kind).toBe('validation')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('5xx повторяется, затем отдаёт http-ошибку', async () => {
    const client = createClient()
    fetchMock.mockImplementation(async () => new Response('{}', { status: 500 }))

    const error = await client.fetchQuery(orgTreeQueryOptions()).catch((e: unknown) => e)
    expect((error as ApiError).kind).toBe('http')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
