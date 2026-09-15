import { describe, expect, it } from 'vitest'
import { BACKOFF_MAX_MS, getBackoffDelay } from './backoff.ts'

describe('getBackoffDelay', () => {
  it('растёт экспоненциально: задержка в [cap/2, cap], cap = 1 с · 2ⁿ', () => {
    expect([0, 1, 2, 3, 4].map((attempt) => getBackoffDelay(attempt, () => 0))).toEqual([500, 1000, 2000, 4000, 8000])
    expect([0, 1, 2, 3, 4].map((attempt) => getBackoffDelay(attempt, () => 1))).toEqual([1000, 2000, 4000, 8000, 16000])
  })

  it('ограничена 30 секундами', () => {
    expect(getBackoffDelay(10, () => 1)).toBe(BACKOFF_MAX_MS)
    expect(getBackoffDelay(50, () => 0)).toBe(BACKOFF_MAX_MS / 2)
  })

  it('минимальная задержка каждой попытки не меньше максимальной задержки предыдущей', () => {
    for (let attempt = 1; attempt < 5; attempt += 1) {
      expect(getBackoffDelay(attempt, () => 0)).toBeGreaterThanOrEqual(getBackoffDelay(attempt - 1, () => 0.999))
    }
  })
})
