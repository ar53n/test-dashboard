import type { IncomingMessage, ServerResponse } from 'node:http'
import type { OrgNode } from '../../../shared/contract.ts'
import {
  aiSearchRequestSchema,
  type AiSearchErrorCode,
  type AiSearchErrorResponse,
  type AiSearchResponse,
} from '../../../shared/orgFilter.ts'
import { filterFromModelOutput, MODEL_FILTER_JSON_SCHEMA } from './filterFromModel.ts'
import { createAiLimiter, type AiLimiter, type AiLimits } from './limiter.ts'
import { buildSystemPrompt } from './prompt.ts'

export interface AiConfig extends AiLimits {
  /** Базовый URL OpenAI-совместимого API, например `https://api.openai.com/v1`. */
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs: number
}

const MAX_BODY_BYTES = 4 * 1024
const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_TIMEOUT_MS = 8_000
/**
 * nginx перед сервером ждёт ответ 30 с (`proxy_read_timeout`) и дальше отдаёт клиенту 504.
 * Ждать провайдера дольше бессмысленно: ответ уже некому получить, поэтому значение
 * сверху ограничено с запасом на обработку ответа.
 */
const MAX_TIMEOUT_MS = 25_000
const DEFAULT_MAX_CONCURRENT = 4
const DEFAULT_RATE_PER_MINUTE = 30

const positiveInt = (value: string | undefined, fallback: number) => {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : fallback
}

const clampTimeout = (value: number) => {
  if (value <= MAX_TIMEOUT_MS) return value
  console.warn(`[ai] AI_TIMEOUT_MS=${value} больше предела ${MAX_TIMEOUT_MS} мс (таймаут nginx) — используем предел`)
  return MAX_TIMEOUT_MS
}

/** Конфигурация из окружения; без ключа или модели AI-поиск выключен (`null`). */
export function readAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig | null {
  const apiKey = env.AI_API_KEY?.trim()
  const model = env.AI_MODEL?.trim()
  if (!apiKey || !model) return null
  return {
    baseUrl: (env.AI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    apiKey,
    model,
    timeoutMs: clampTimeout(positiveInt(env.AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)),
    maxConcurrent: positiveInt(env.AI_MAX_CONCURRENT, DEFAULT_MAX_CONCURRENT),
    ratePerMinute: positiveInt(env.AI_RATE_LIMIT_PER_MINUTE, DEFAULT_RATE_PER_MINUTE),
  }
}

class BodyTooLargeError extends Error {}

async function readBody(req: IncomingMessage, limit: number): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > limit) throw new BodyTooLargeError()
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function send(
  res: ServerResponse,
  status: number,
  body: AiSearchResponse | AiSearchErrorResponse,
  headers: Record<string, string> = {},
) {
  if (res.headersSent || res.destroyed) return
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  res.end(JSON.stringify(body))
}

const fail = (res: ServerResponse, status: number, error: AiSearchErrorCode, message: string) =>
  send(res, status, { error, message })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Ответ провайдера — недоверенный JSON: `null`, массив или строка не должны ронять обработчик. */
function firstChoiceMessage(completion: unknown): { content?: unknown; refusal?: unknown } | null {
  if (!isRecord(completion) || !Array.isArray(completion.choices)) return null
  const choice: unknown = completion.choices[0]
  return isRecord(choice) && isRecord(choice.message) ? choice.message : null
}

/**
 * `POST /api/ai-search {query}` → `{filter}`. Ключ провайдера остаётся на сервере.
 * Запрос к провайдеру прерывается по таймауту и при закрытии соединения клиентом.
 * Лимиты частоты и параллельности общие для всех клиентов и защищают бюджет провайдера.
 */
export function createAiSearchHandler(config: AiConfig | null) {
  const limiter = config ? createAiLimiter(config) : null
  return (req: IncomingMessage, res: ServerResponse, getNodes: () => readonly OrgNode[]) =>
    handleAiSearch(req, res, config, limiter, getNodes)
}

async function handleAiSearch(
  req: IncomingMessage,
  res: ServerResponse,
  config: AiConfig | null,
  limiter: AiLimiter | null,
  getNodes: () => readonly OrgNode[],
) {
  let body: string
  try {
    body = await readBody(req, MAX_BODY_BYTES)
  } catch (error) {
    if (error instanceof BodyTooLargeError) return fail(res, 413, 'bad_request', 'Слишком большой запрос')
    throw error
  }

  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    return fail(res, 400, 'bad_request', 'Тело запроса должно быть JSON')
  }
  const parsed = aiSearchRequestSchema.safeParse(json)
  if (!parsed.success) return fail(res, 400, 'bad_request', 'Ожидается {"query": "строка до 300 символов"}')

  if (!config || !limiter) return fail(res, 503, 'not_configured', 'AI-поиск не настроен на сервере')

  // Лимит проверяется после валидации: платным считается только запрос, который дойдёт до провайдера.
  const permit = limiter.tryAcquire()
  if (!permit.ok) {
    return send(
      res,
      429,
      { error: 'rate_limited', message: 'Слишком много AI-запросов, попробуйте позже' },
      { 'Retry-After': String(permit.retryAfterSeconds) },
    )
  }

  const clientGone = new AbortController()
  const onClose = () => {
    if (!res.writableEnded) clientGone.abort()
  }
  res.on('close', onClose)
  const timeout = AbortSignal.timeout(config.timeoutMs)
  const signal = AbortSignal.any([clientGone.signal, timeout])

  try {
    let upstream: Response
    try {
      upstream = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: buildSystemPrompt(getNodes()) },
            { role: 'user', content: parsed.data.query },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'org_filter', strict: true, schema: MODEL_FILTER_JSON_SCHEMA },
          },
        }),
      })
    } catch (error) {
      if (clientGone.signal.aborted) return
      if (timeout.aborted) return fail(res, 504, 'timeout', 'AI-провайдер не ответил вовремя')
      console.warn('[ai] запрос к провайдеру не удался:', (error as Error).message)
      return fail(res, 502, 'upstream_error', 'AI-провайдер недоступен')
    }

    if (!upstream.ok) {
      // Тело ошибки провайдера клиенту не передаётся: в нём могут быть детали аккаунта.
      console.warn(`[ai] провайдер ответил ${upstream.status}`)
      await upstream.body?.cancel().catch(() => {})
      return fail(res, 502, 'upstream_error', `AI-провайдер ответил ошибкой ${upstream.status}`)
    }

    let completion: unknown
    try {
      completion = await upstream.json()
    } catch {
      if (clientGone.signal.aborted) return
      if (timeout.aborted) return fail(res, 504, 'timeout', 'AI-провайдер не ответил вовремя')
      return fail(res, 502, 'invalid_model_output', 'Некорректный ответ AI-провайдера')
    }

    const message = firstChoiceMessage(completion)
    if (!message) {
      console.warn('[ai] ответ провайдера без choices[0].message')
      return fail(res, 502, 'invalid_model_output', 'Некорректный ответ AI-провайдера')
    }
    const result = filterFromModelOutput(message.content)
    if (!result.ok) {
      console.warn('[ai] ответ модели не прошёл схему:', message.refusal ?? result.issues.join('; '))
      return fail(res, 502, 'invalid_model_output', 'AI вернул фильтр не по схеме')
    }
    send(res, 200, { filter: result.filter })
  } finally {
    permit.release()
    res.off('close', onClose)
  }
}
