import { describe, expect, it } from 'vitest'
import { describeStatus } from './describeStatus.ts'

describe('describeStatus', () => {
  it('live-соединение и синхронизация', () => {
    expect(describeStatus({ connection: { kind: 'open' }, phase: 'live' }, 0)).toMatchObject({
      tone: 'ok',
      label: 'В реальном времени',
    })
    expect(describeStatus({ connection: { kind: 'open' }, phase: 'resyncing' }, 0).label).toBe('Синхронизация…')
    expect(describeStatus(null, 0).tone).toBe('muted')
  })

  it('обратный отсчёт до переподключения не превышает выбранную задержку', () => {
    const connection = { kind: 'reconnecting', attempt: 3, retryAt: 10_000, delayMs: 4_000 } as const
    expect(describeStatus({ connection, phase: 'waiting' }, 7_500).detail).toBe('повтор через 3 с · попытка 3')
    // Устаревший `now` в первом кадре: показываем задержку, а не 10 с.
    expect(describeStatus({ connection, phase: 'waiting' }, 0).detail).toBe('повтор через 4 с · попытка 3')
    expect(describeStatus({ connection, phase: 'waiting' }, 10_500).detail).toBe('попытка 3…')
  })

  it('нет сети', () => {
    expect(describeStatus({ connection: { kind: 'offline' }, phase: 'waiting' }, 0)).toMatchObject({
      tone: 'danger',
      label: 'Нет сети',
    })
  })
})
