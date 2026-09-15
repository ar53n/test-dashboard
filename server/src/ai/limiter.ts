export interface AiLimits {
  /** Сколько запросов к провайдеру может идти одновременно. */
  maxConcurrent: number
  /** Сколько запросов к провайдеру допускается в минуту, с равномерным восполнением. */
  ratePerMinute: number
}

export type AiPermit = { ok: true; release: () => void } | { ok: false; retryAfterSeconds: number }

/**
 * Общие для всех клиентов лимиты платных вызовов: token bucket по частоте и счётчик параллельных
 * запросов. Лимит не зависит от адреса клиента, поэтому подмена заголовков его не обходит;
 * справедливость между клиентами обеспечивает nginx (`limit_req` по IP).
 */
export function createAiLimiter({ maxConcurrent, ratePerMinute }: AiLimits, now: () => number = Date.now) {
  const refillPerMs = ratePerMinute / 60_000
  let tokens = ratePerMinute
  let refilledAt = now()
  let active = 0

  return {
    tryAcquire(): AiPermit {
      const time = now()
      tokens = Math.min(ratePerMinute, tokens + (time - refilledAt) * refillPerMs)
      refilledAt = time

      if (active >= maxConcurrent) return { ok: false, retryAfterSeconds: 1 }
      if (tokens < 1) return { ok: false, retryAfterSeconds: Math.ceil((1 - tokens) / refillPerMs / 1000) }

      tokens -= 1
      active += 1
      let released = false
      return {
        ok: true,
        release: () => {
          if (released) return
          released = true
          active -= 1
        },
      }
    },
  }
}

export type AiLimiter = ReturnType<typeof createAiLimiter>
