import { describe, expect, it } from 'vitest'
import { createAiLimiter } from './limiter.ts'

function clock(start = 0) {
  let time = start
  return { now: () => time, advance: (ms: number) => (time += ms) }
}

describe('createAiLimiter', () => {
  it('частота: не больше perMinute вызовов подряд, токены восполняются равномерно', () => {
    const time = clock()
    const limiter = createAiLimiter({ maxConcurrent: 10, ratePerMinute: 2 }, time.now)

    const first = limiter.tryAcquire()
    const second = limiter.tryAcquire()
    expect(first.ok && second.ok).toBe(true)
    if (first.ok) first.release()
    if (second.ok) second.release()

    // Освобождение слота не возвращает токен: лимит частоты считает вызовы, а не параллельность.
    expect(limiter.tryAcquire()).toEqual({ ok: false, retryAfterSeconds: 30 })

    time.advance(29_000)
    expect(limiter.tryAcquire()).toEqual({ ok: false, retryAfterSeconds: 1 })
    time.advance(1_000)
    expect(limiter.tryAcquire().ok).toBe(true)
  })

  it('параллельность: слот освобождается release, повторный release не освобождает чужой слот', () => {
    const limiter = createAiLimiter({ maxConcurrent: 1, ratePerMinute: 100 }, clock().now)

    const first = limiter.tryAcquire()
    if (!first.ok) throw new Error('первый вызов должен пройти')
    expect(limiter.tryAcquire()).toEqual({ ok: false, retryAfterSeconds: 1 })

    first.release()
    const second = limiter.tryAcquire()
    expect(second.ok).toBe(true)

    first.release()
    expect(limiter.tryAcquire().ok).toBe(false)
  })

  it('отказ по параллельности не расходует токен частоты', () => {
    const limiter = createAiLimiter({ maxConcurrent: 1, ratePerMinute: 2 }, clock().now)
    const first = limiter.tryAcquire()
    if (!first.ok) throw new Error('первый вызов должен пройти')
    for (let i = 0; i < 5; i += 1) expect(limiter.tryAcquire().ok).toBe(false)
    first.release()
    expect(limiter.tryAcquire().ok).toBe(true)
  })
})
