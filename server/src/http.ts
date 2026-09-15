import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { formatEtag, ORG_EPOCH_HEADER, ORG_REVISION_HEADER } from '../../shared/contract.ts'
import { createAiSearchHandler, type AiConfig } from './ai/aiSearch.ts'
import type { OrgStore } from './store.ts'

export interface HttpServerOptions {
  /** Конфигурация AI-поиска; `null` — эндпоинт отвечает 503. */
  ai?: AiConfig | null
}

const SLOW_DELAY_MS = 3000

type Scenario = 'error' | 'empty' | 'invalid' | 'slow'
const SCENARIOS = new Set<string>(['error', 'empty', 'invalid', 'slow'])

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers })
  res.end(JSON.stringify(body))
}

/**
 * Демо-сценарии для проверки состояний клиента. Такие ответы не кэшируются
 * и не несут версию состояния.
 */
function handleScenario(scenario: Scenario, req: IncomingMessage, res: ServerResponse, store: OrgStore) {
  const noStore = { 'Cache-Control': 'no-store' }
  switch (scenario) {
    case 'error':
      return sendJson(res, 500, { error: 'Сценарий error: внутренняя ошибка сервера' }, noStore)
    case 'empty':
      return sendJson(res, 200, [], noStore)
    case 'invalid':
      return sendJson(
        res,
        200,
        [{ id: 1, name: null, parentId: 'missing', headcount: -5, budget: 'много', performance: 140 }],
        noStore,
      )
    case 'slow': {
      const timer = setTimeout(() => sendJson(res, 200, store.snapshot(), noStore), SLOW_DELAY_MS)
      // Клиент отменил запрос — не держим таймер и не пишем в закрытый сокет.
      req.on('close', () => clearTimeout(timer))
      return
    }
  }
}

/**
 * Слабое сравнение ETag (RFC 9110): `W/"…"` равен `"…"`, поддерживаются список и `*`.
 * nginx при gzip-сжатии ответа превращает ETag в слабый, и клиент за прокси может прислать его.
 */
function matchesEtag(header: string | undefined, etag: string): boolean {
  if (!header) return false
  const strip = (tag: string) => tag.trim().replace(/^W\//, '')
  return header.split(',').some((tag) => tag.trim() === '*' || strip(tag) === etag)
}

function handleOrgTree(req: IncomingMessage, res: ServerResponse, url: URL, store: OrgStore) {
  const scenario = url.searchParams.get('scenario')
  if (scenario && SCENARIOS.has(scenario)) {
    return handleScenario(scenario as Scenario, req, res, store)
  }

  const etag = formatEtag(store.epoch, store.revision)
  const versionHeaders = {
    ETag: etag,
    [ORG_EPOCH_HEADER]: store.epoch,
    [ORG_REVISION_HEADER]: String(store.revision),
    'Cache-Control': 'no-cache',
  }

  if (matchesEtag(req.headers['if-none-match'], etag)) {
    res.writeHead(304, versionHeaders)
    return res.end()
  }

  sendJson(res, 200, store.snapshot(), versionHeaders)
}

function parseRequestUrl(req: IncomingMessage): URL | null {
  try {
    return new URL(req.url ?? '/', 'http://localhost')
  } catch {
    return null
  }
}

type AiSearchHandler = ReturnType<typeof createAiSearchHandler>

function route(req: IncomingMessage, res: ServerResponse, store: OrgStore, aiSearch: AiSearchHandler): unknown {
  const url = parseRequestUrl(req)
  if (!url) return sendJson(res, 400, { error: 'Bad request' })

  if (req.method === 'GET' && url.pathname === '/api/org-tree') {
    return handleOrgTree(req, res, url, store)
  }
  if (url.pathname === '/api/ai-search') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' })
    return aiSearch(req, res, () => store.snapshot())
  }
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { status: 'ok', epoch: store.epoch, revision: store.revision })
  }

  sendJson(res, 404, { error: 'Not found' })
}

export function createHttpServer(store: OrgStore, options: HttpServerOptions = {}): Server {
  const aiSearch = createAiSearchHandler(options.ai ?? null)
  return createServer((req, res) => {
    // Ошибка в обработке одного запроса не должна останавливать сервер для всех клиентов.
    const handleError = (error: unknown) => {
      console.error('[server] request failed', error)
      if (res.headersSent) res.destroy()
      else sendJson(res, 500, { error: 'Internal server error' })
    }
    try {
      const result = route(req, res, store, aiSearch)
      if (result instanceof Promise) result.catch(handleError)
    } catch (error) {
      handleError(error)
    }
  })
}
