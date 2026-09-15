import { ORG_EPOCH_HEADER, ORG_REVISION_HEADER, type PatchMessage } from '@shared/contract.ts'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { orgTreeQueryKey, orgTreeQueryOptions } from '@/entities/org/api/orgTreeQuery.ts'
import { computeAggregates } from '@/entities/org/model/aggregate.ts'
import { makeNode } from '@/entities/org/model/testUtils.ts'
import { createQueryCacheTarget, liveUrl } from './liveOrgSync.ts'

vi.mock('@/entities/org/model/aggregate.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/entities/org/model/aggregate.ts')>()
  return { ...original, computeAggregates: vi.fn(original.computeAggregates) }
})

const nodes = [makeNode('div', null, { headcount: 1 }), makeNode('team', 'div', { headcount: 10 })]
const at = '2026-09-15T10:00:00.000Z'

const snapshotResponse = (revision: number, epoch = 'e1') =>
  new Response(JSON.stringify(nodes), {
    status: 200,
    headers: { [ORG_EPOCH_HEADER]: epoch, [ORG_REVISION_HEADER]: String(revision) },
  })

const patch = (revision: number, headcount: number): PatchMessage => ({
  type: 'patch',
  epoch: 'e1',
  revision,
  changes: [{ id: 'team', headcount, updatedAt: at }],
})

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(computeAggregates).mockClear()
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const createClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('createQueryCacheTarget', () => {
  it('патч обновляет модель в кэше без полной агрегации и уведомляет подписчиков', async () => {
    const client = createClient()
    fetchMock.mockResolvedValueOnce(snapshotResponse(1))
    await client.fetchQuery(orgTreeQueryOptions())
    const target = createQueryCacheTarget(client)
    const listener = vi.fn()
    target.subscribeModel(listener)

    target.applyPatch(patch(2, 15))

    const model = target.getModel()!
    expect(model.version).toEqual({ epoch: 'e1', revision: 2 })
    expect(model.aggregates.get('div')!.totalHeadcount).toBe(16)
    expect(computeAggregates).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('в push-режиме данные не устаревают: запросы по staleTime не уходят', async () => {
    vi.useFakeTimers()
    const client = createClient()
    fetchMock.mockImplementation(async () => snapshotResponse(1))
    await client.fetchQuery(orgTreeQueryOptions())
    const target = createQueryCacheTarget(client)

    target.setPushed(true)
    vi.advanceTimersByTime(60_000)
    await client.prefetchQuery(orgTreeQueryOptions())
    expect(fetchMock).toHaveBeenCalledTimes(1)

    target.setPushed(false)
    await client.prefetchQuery(orgTreeQueryOptions())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('снимок после патчей: условный запрос с версией патча, устаревший ответ модель не откатывает', async () => {
    const client = createClient()
    fetchMock.mockResolvedValueOnce(snapshotResponse(1))
    await client.fetchQuery(orgTreeQueryOptions())
    const target = createQueryCacheTarget(client)
    target.applyPatch(patch(2, 15))
    target.applyPatch(patch(3, 20))
    const patched = target.getModel()

    fetchMock.mockResolvedValueOnce(snapshotResponse(2))
    await target.fetchSnapshot()

    const [, init] = fetchMock.mock.calls[1]
    expect(new Headers(init!.headers).get('If-None-Match')).toBe('"e1-3"')
    expect(target.getModel()).toBe(patched)
    expect(target.getModel()!.nodes.get('team')!.headcount).toBe(20)
  })

  it('fetchSnapshot отменяет идущий запрос и отклоняется при ошибке', async () => {
    const client = createClient()
    fetchMock.mockResolvedValueOnce(snapshotResponse(1))
    await client.fetchQuery(orgTreeQueryOptions())
    const target = createQueryCacheTarget(client)

    let firstSignal: AbortSignal | undefined
    fetchMock.mockImplementationOnce((_url, init) => {
      firstSignal = init!.signal!
      return new Promise(() => {})
    })
    void client.refetchQueries({ queryKey: orgTreeQueryKey() })
    await vi.waitFor(() => expect(firstSignal).toBeDefined())

    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }))
    await expect(target.fetchSnapshot()).rejects.toThrow()
    expect(firstSignal!.aborted).toBe(true)
  })
})

describe('liveUrl', () => {
  it('строит ws/wss-адрес от текущего хоста', () => {
    expect(liveUrl({ protocol: 'http:', host: 'localhost:5173' })).toBe('ws://localhost:5173/api/live')
    expect(liveUrl({ protocol: 'https:', host: 'example.com' })).toBe('wss://example.com/api/live')
  })
})
