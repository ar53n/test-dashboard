import { createServer, request, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateOrgTree } from '../data/generate.ts'
import { createHttpServer } from '../http.ts'
import { OrgStore } from '../store.ts'
import { readAiConfig, type AiConfig } from './aiSearch.ts'

type UpstreamHandler = (req: IncomingMessage, body: string, res: ServerResponse) => void

let upstream: Server
let upstreamHandler: UpstreamHandler
let upstreamUrl = ''
let app: Server
let appUrl = ''
const upstreamClosed = vi.fn()

const listen = async (server: Server) => {
  await new Promise<void>((resolve) => server.listen(0, resolve))
  return `http://localhost:${(server.address() as AddressInfo).port}`
}

async function startApp(ai: AiConfig | null) {
  app = createHttpServer(new OrgStore(generateOrgTree()), { ai })
  appUrl = await listen(app)
}

const config = (overrides: Partial<AiConfig> = {}): AiConfig => ({
  baseUrl: `${upstreamUrl}/v1`,
  apiKey: 'test-key',
  model: 'test-model',
  timeoutMs: 2_000,
  maxConcurrent: 10,
  ratePerMinute: 100,
  ...overrides,
})

const completion = (content: unknown) => ({
  choices: [{ message: { role: 'assistant', content: typeof content === 'string' ? content : JSON.stringify(content) } }],
})

const emptyModelFilter = { nameContains: null, ancestorName: null, levels: null, metrics: null, sort: null, limit: null }

const search = (body: unknown) =>
  fetch(`${appUrl}/api/ai-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

beforeEach(async () => {
  upstreamClosed.mockReset()
  upstream = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => upstreamHandler(req, body, res))
    res.on('close', () => {
      if (!res.writableEnded) upstreamClosed()
    })
  })
  upstreamUrl = await listen(upstream)
})

afterEach(async () => {
  app.closeAllConnections()
  upstream.closeAllConnections()
  await Promise.all([new Promise((r) => app.close(r)), new Promise((r) => upstream.close(r))])
})

describe('POST /api/ai-search', () => {
  it('отправляет запрос в OpenAI-совместимый API со strict json_schema и возвращает фильтр', async () => {
    let captured: { req: IncomingMessage; body: Record<string, any> } | undefined
    upstreamHandler = (req, body, res) => {
      captured = { req, body: JSON.parse(body) }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify(
          completion({
            ...emptyModelFilter,
            levels: [3, 3],
            ancestorName: 'Продаж',
            metrics: [{ field: 'totalBudget', op: 'gt', value: 1_000_000 }],
            nameContains: '  ',
          }),
        ),
      )
    }
    await startApp(config())

    const response = await search({ query: 'команды продаж с бюджетом больше миллиона' })

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      filter: { levels: [3], ancestorName: 'Продаж', metrics: [{ field: 'totalBudget', op: 'gt', value: 1_000_000 }] },
    })
    expect(captured!.req.url).toBe('/v1/chat/completions')
    expect(captured!.req.headers.authorization).toBe('Bearer test-key')
    expect(captured!.body.model).toBe('test-model')
    expect(captured!.body.response_format).toMatchObject({ type: 'json_schema', json_schema: { strict: true } })
    expect(captured!.body.messages[0].content).toContain('Продажи')
    expect(captured!.body.messages[1]).toEqual({ role: 'user', content: 'команды продаж с бюджетом больше миллиона' })
  })

  it('без настроенного ключа — 503, провайдер не вызывается', async () => {
    upstreamHandler = vi.fn()
    await startApp(null)
    const response = await search({ query: 'отделы' })
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ error: 'not_configured' })
    expect(upstreamHandler).not.toHaveBeenCalled()
  })

  it('валидирует тело запроса', async () => {
    upstreamHandler = vi.fn()
    await startApp(config())
    expect((await search('{oops')).status).toBe(400)
    expect((await search({ query: '' })).status).toBe(400)
    expect((await search({ query: 'x'.repeat(301) })).status).toBe(400)
    expect((await search({ query: 'ok', extra: 1 })).status).toBe(400)
    expect((await search({ query: 'x'.repeat(5000) })).status).toBe(413)
    expect((await fetch(`${appUrl}/api/ai-search`)).status).toBe(405)
    expect(upstreamHandler).not.toHaveBeenCalled()
  })

  it('ответ модели не по схеме — 502 invalid_model_output', async () => {
    upstreamHandler = (_req, _body, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(completion({ ...emptyModelFilter, metrics: [{ field: 'avgPerformance', op: 'gt', value: 150 }] })))
    }
    await startApp(config())
    const response = await search({ query: 'эффективность выше 150' })
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ error: 'invalid_model_output' })
  })

  it.each([['null'], ['[]'], ['"text"'], ['{"choices":null}'], ['{"choices":[null]}']])(
    'оболочка ответа провайдера не по формату (%s) — 502 invalid_model_output',
    async (body) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      upstreamHandler = (_req, _body, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(body)
      }
      await startApp(config())
      const response = await search({ query: 'отделы' })
      expect(response.status).toBe(502)
      expect(await response.json()).toMatchObject({ error: 'invalid_model_output' })
    },
  )

  it('лимит частоты общий для всех клиентов — 429 с Retry-After, провайдер не вызывается', async () => {
    const calls = vi.fn()
    upstreamHandler = (_req, _body, res) => {
      calls()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(completion({ ...emptyModelFilter, levels: [2] })))
    }
    await startApp(config({ ratePerMinute: 2 }))

    expect((await search({ query: 'отделы' })).status).toBe(200)
    expect((await search({ query: 'отделы' })).status).toBe(200)
    const limited = await search({ query: 'отделы' })
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(await limited.json()).toMatchObject({ error: 'rate_limited' })
    expect(calls).toHaveBeenCalledTimes(2)
  })

  it('лимит параллельных запросов — 429, слот освобождается после ответа провайдера', async () => {
    const pending: ServerResponse[] = []
    let upstreamReached!: () => void
    const reached = new Promise<void>((resolve) => (upstreamReached = resolve))
    upstreamHandler = (_req, _body, res) => {
      pending.push(res)
      upstreamReached()
    }
    await startApp(config({ maxConcurrent: 1 }))

    const first = search({ query: 'отделы' })
    await reached
    expect((await search({ query: 'команды' })).status).toBe(429)

    pending[0].writeHead(200, { 'Content-Type': 'application/json' })
    pending[0].end(JSON.stringify(completion({ ...emptyModelFilter, levels: [2] })))
    expect((await first).status).toBe(200)

    upstreamHandler = (_req, _body, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(completion({ ...emptyModelFilter, levels: [3] })))
    }
    expect((await search({ query: 'команды' })).status).toBe(200)
  })

  it('невалидный запрос и выключенный AI не расходуют лимит', async () => {
    upstreamHandler = (_req, _body, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(completion({ ...emptyModelFilter, levels: [2] })))
    }
    await startApp(config({ ratePerMinute: 1 }))
    for (let i = 0; i < 3; i += 1) expect((await search({ query: '' })).status).toBe(400)
    expect((await search({ query: 'отделы' })).status).toBe(200)
  })

  it('ошибка провайдера — 502 без передачи тела ошибки клиенту', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    upstreamHandler = (_req, _body, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'Incorrect API key sk-secret' } }))
    }
    await startApp(config())
    const response = await search({ query: 'отделы' })
    const text = await response.text()
    expect(response.status).toBe(502)
    expect(text).not.toContain('sk-secret')
  })

  it('таймаут провайдера — 504, запрос к провайдеру прерывается', async () => {
    upstreamHandler = () => {}
    await startApp(config({ timeoutMs: 100 }))
    const response = await search({ query: 'отделы' })
    expect(response.status).toBe(504)
    await vi.waitFor(() => expect(upstreamClosed).toHaveBeenCalled())
  })

  it('клиент закрыл соединение — запрос к провайдеру отменяется', async () => {
    let upstreamReached!: () => void
    const reached = new Promise<void>((resolve) => (upstreamReached = resolve))
    upstreamHandler = () => upstreamReached()
    await startApp(config({ timeoutMs: 10_000 }))

    const clientRequest = request(`${appUrl}/api/ai-search`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
    clientRequest.on('error', () => {})
    clientRequest.end(JSON.stringify({ query: 'отделы' }))
    await reached
    clientRequest.destroy()

    await vi.waitFor(() => expect(upstreamClosed).toHaveBeenCalled())
  })
})

describe('readAiConfig', () => {
  it('без ключа или модели — выключено; baseUrl по умолчанию и без завершающего слеша', () => {
    expect(readAiConfig({ AI_MODEL: 'm' })).toBeNull()
    expect(readAiConfig({ AI_API_KEY: 'k' })).toBeNull()
    expect(readAiConfig({ AI_API_KEY: 'k', AI_MODEL: 'm' })).toEqual({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'k',
      model: 'm',
      timeoutMs: 8000,
      maxConcurrent: 4,
      ratePerMinute: 30,
    })
    expect(
      readAiConfig({
        AI_API_KEY: 'k',
        AI_MODEL: 'm',
        AI_BASE_URL: 'http://llm:8000/v1/',
        AI_TIMEOUT_MS: '3000',
        AI_MAX_CONCURRENT: '2',
        AI_RATE_LIMIT_PER_MINUTE: '10',
      }),
    ).toMatchObject({ baseUrl: 'http://llm:8000/v1', timeoutMs: 3000, maxConcurrent: 2, ratePerMinute: 10 })
    expect(readAiConfig({ AI_API_KEY: 'k', AI_MODEL: 'm', AI_MAX_CONCURRENT: '0', AI_RATE_LIMIT_PER_MINUTE: 'x' })).toMatchObject({
      maxConcurrent: 4,
      ratePerMinute: 30,
    })
  })

  it('таймаут ограничен сверху таймаутом nginx: ответ дольше него клиент всё равно не получит', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(readAiConfig({ AI_API_KEY: 'k', AI_MODEL: 'm', AI_TIMEOUT_MS: '60000' })).toMatchObject({ timeoutMs: 25_000 })
    expect(warn).toHaveBeenCalled()
    expect(readAiConfig({ AI_API_KEY: 'k', AI_MODEL: 'm', AI_TIMEOUT_MS: '25000' })).toMatchObject({ timeoutMs: 25_000 })
    warn.mockRestore()
  })
})
