export type ApiErrorKind = 'network' | 'http' | 'validation'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | undefined
  readonly details: readonly string[]

  constructor(kind: ApiErrorKind, message: string, options: { status?: number; details?: string[]; cause?: unknown } = {}) {
    super(message, { cause: options.cause })
    this.name = 'ApiError'
    this.kind = kind
    this.status = options.status
    this.details = options.details ?? []
  }
}

/** Повторять имеет смысл только сетевые сбои и 5xx; невалидный ответ от повтора не исправится. */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  return error.kind === 'network' || (error.kind === 'http' && (error.status ?? 0) >= 500)
}

const SCENARIO_PARAM = 'scenario'

/**
 * Демо-сценарий (`?scenario=error|empty|invalid|slow`) из адреса страницы
 * пробрасывается в API, чтобы вручную проверять состояния интерфейса.
 */
export function getScenario(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(SCENARIO_PARAM)
}

export function apiUrl(path: string): string {
  const scenario = getScenario()
  return scenario ? `${path}?${SCENARIO_PARAM}=${encodeURIComponent(scenario)}` : path
}

/** `fetch`, который превращает сетевые сбои в `ApiError`, но пропускает отмену как есть. */
export async function request(url: string, init: RequestInit & { signal: AbortSignal }): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (error) {
    if (init.signal.aborted) throw error
    throw new ApiError('network', 'Не удалось связаться с сервером', { cause: error })
  }
}

/**
 * Читает и разбирает JSON-тело. Чтение и разбор разделены: обрыв соединения после
 * заголовков — сетевая ошибка (её можно повторить), отмена остаётся отменой,
 * и только синтаксически неверное тело считается ошибкой данных.
 */
export async function readJson(response: Response, signal: AbortSignal): Promise<unknown> {
  let text: string
  try {
    text = await response.text()
  } catch (error) {
    if (signal.aborted) throw error
    throw new ApiError('network', 'Соединение прервалось при получении данных', { cause: error })
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    throw new ApiError('validation', 'Сервер вернул некорректный JSON', { cause: error })
  }
}

export function httpError(response: Response): ApiError {
  return new ApiError('http', `Сервер ответил ошибкой ${response.status}`, { status: response.status })
}
