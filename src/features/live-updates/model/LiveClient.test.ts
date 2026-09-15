import type { ServerMessage } from '@shared/contract.ts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveClient, type NetworkMonitor, type SocketLike } from './LiveClient.ts'

class FakeSocket {
  static instances: FakeSocket[] = []
  onopen: SocketLike['onopen'] = null
  onmessage: SocketLike['onmessage'] = null
  onclose: SocketLike['onclose'] = null
  onerror: SocketLike['onerror'] = null
  closed = false
  readonly url: string

  constructor(url: string) {
    this.url = url
    FakeSocket.instances.push(this)
  }

  close() {
    this.closed = true
  }

  // Методы «со стороны сервера».
  open() {
    this.onopen?.call(this as never, new Event('open'))
  }
  send(message: ServerMessage | string) {
    const data = typeof message === 'string' ? message : JSON.stringify(message)
    this.onmessage?.call(this as never, { data } as MessageEvent)
  }
  drop() {
    this.onclose?.call(this as never, new Event('close') as CloseEvent)
  }
}

function createNetwork(initiallyOnline = true) {
  let online = initiallyOnline
  const listeners = new Set<{ onOnline: () => void; onOffline: () => void }>()
  const network: NetworkMonitor = {
    isOnline: () => online,
    subscribe(onOnline, onOffline) {
      const entry = { onOnline, onOffline }
      listeners.add(entry)
      return () => listeners.delete(entry)
    },
  }
  return {
    network,
    listenerCount: () => listeners.size,
    goOffline() {
      online = false
      listeners.forEach((entry) => entry.onOffline())
    },
    goOnline() {
      online = true
      listeners.forEach((entry) => entry.onOnline())
    },
  }
}

const hello: ServerMessage = { type: 'hello', epoch: 'e1', revision: 0 }
const lastSocket = () => FakeSocket.instances.at(-1)!

function setup({ online = true } = {}) {
  const net = createNetwork(online)
  const onMessage = vi.fn()
  const onDisconnect = vi.fn()
  const client = new LiveClient({
    url: 'ws://test/api/live',
    onMessage,
    onDisconnect,
    createSocket: (url) => new FakeSocket(url) as unknown as SocketLike,
    network: net.network,
    random: () => 1, // верхняя граница: задержки 1, 2, 4, 8… с
    now: () => Date.now(),
    idleTimeoutMs: 45_000,
    connectTimeoutMs: 10_000,
  })
  return { client, onMessage, onDisconnect, net }
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeSocket.instances = []
})

afterEach(() => {
  vi.useRealTimers()
})

describe('LiveClient: подключение', () => {
  it('подключается после start, передаёт валидные сообщения и пропускает невалидные', () => {
    const { client, onMessage } = setup()
    client.start()
    expect(client.getStatus()).toEqual({ kind: 'connecting' })
    vi.advanceTimersByTime(0)
    expect(lastSocket().url).toBe('ws://test/api/live')

    lastSocket().open()
    expect(client.getStatus()).toEqual({ kind: 'open' })

    vi.spyOn(console, 'warn').mockImplementation(() => {})
    lastSocket().send('{broken')
    lastSocket().send(hello)
    expect(onMessage).toHaveBeenCalledTimes(1)
    expect(onMessage).toHaveBeenCalledWith(hello)
  })

  it('stop до фактического подключения не создаёт сокет (двойное монтирование StrictMode)', () => {
    const { client } = setup()
    client.start()
    client.stop()
    client.start()
    vi.advanceTimersByTime(0)
    expect(FakeSocket.instances).toHaveLength(1)
  })
})

describe('LiveClient: переподключение', () => {
  it('backoff растёт с каждой неудачей и сбрасывается после hello', () => {
    const { client, onDisconnect } = setup()
    const listener = vi.fn()
    client.subscribe(listener)
    client.start()
    vi.advanceTimersByTime(0)

    const delays: number[] = []
    for (let i = 0; i < 4; i += 1) {
      lastSocket().drop()
      const status = client.getStatus()
      if (status.kind !== 'reconnecting') throw new Error(`unexpected ${status.kind}`)
      delays.push(status.delayMs)
      expect(status.attempt).toBe(i + 1)
      vi.advanceTimersByTime(status.delayMs - 1)
      expect(FakeSocket.instances).toHaveLength(i + 1)
      vi.advanceTimersByTime(1)
      expect(FakeSocket.instances).toHaveLength(i + 2)
    }
    expect(delays).toEqual([1000, 2000, 4000, 8000])
    expect(onDisconnect).toHaveBeenCalledTimes(4)
    expect(listener).toHaveBeenCalled()

    lastSocket().open()
    lastSocket().send(hello)
    lastSocket().drop()
    expect(client.getStatus()).toMatchObject({ kind: 'reconnecting', attempt: 1, delayMs: 1000 })
  })

  it('события закрытого старого сокета не влияют на новое соединение', () => {
    const { client, onDisconnect } = setup()
    client.start()
    vi.advanceTimersByTime(0)
    const old = lastSocket()
    old.drop()
    vi.advanceTimersByTime(1000)
    lastSocket().open()

    old.drop()
    old.send(hello)
    expect(onDisconnect).toHaveBeenCalledTimes(1)
    expect(client.getStatus()).toEqual({ kind: 'open' })
  })

  it('долгая тишина от сервера считается обрывом', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { client, onDisconnect } = setup()
    client.start()
    vi.advanceTimersByTime(0)
    lastSocket().open()
    lastSocket().send(hello)

    vi.advanceTimersByTime(44_000)
    lastSocket().send({ type: 'heartbeat', epoch: 'e1', revision: 0, serverTime: new Date().toISOString() })
    vi.advanceTimersByTime(44_000)
    expect(onDisconnect).not.toHaveBeenCalled()

    const socket = lastSocket()
    vi.advanceTimersByTime(1_000)
    expect(onDisconnect).toHaveBeenCalledTimes(1)
    expect(socket.closed).toBe(true)
    expect(client.getStatus().kind).toBe('reconnecting')
  })

  it('зависшая установка соединения прерывается по таймауту и уходит в backoff', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { client, onDisconnect } = setup()
    client.start()
    vi.advanceTimersByTime(0)
    const hung = lastSocket()

    vi.advanceTimersByTime(9_999)
    expect(client.getStatus()).toEqual({ kind: 'connecting' })
    vi.advanceTimersByTime(1)
    expect(hung.closed).toBe(true)
    expect(onDisconnect).toHaveBeenCalledTimes(1)
    expect(client.getStatus()).toMatchObject({ kind: 'reconnecting', attempt: 1 })

    // После open действует таймаут тишины, а не таймаут установки.
    vi.advanceTimersByTime(1000)
    lastSocket().open()
    vi.advanceTimersByTime(30_000)
    expect(client.getStatus()).toEqual({ kind: 'open' })
  })
})

describe('LiveClient: сеть', () => {
  it('без сети не подключается; при появлении сети подключается сразу, без ожидания backoff', () => {
    const { client, net } = setup({ online: false })
    client.start()
    vi.advanceTimersByTime(60_000)
    expect(client.getStatus()).toEqual({ kind: 'offline' })
    expect(FakeSocket.instances).toHaveLength(0)

    net.goOnline()
    expect(FakeSocket.instances).toHaveLength(1)
  })

  it('потеря сети закрывает открытый сокет и отменяет запланированный повтор', () => {
    const { client, net, onDisconnect } = setup()
    client.start()
    vi.advanceTimersByTime(0)
    lastSocket().open()

    net.goOffline()
    expect(onDisconnect).toHaveBeenCalledTimes(1)
    expect(lastSocket().closed).toBe(true)
    expect(client.getStatus()).toEqual({ kind: 'offline' })

    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.instances).toHaveLength(1)
  })
})

describe('LiveClient: stop', () => {
  it('закрывает сокет, снимает подписку на сеть и очищает все таймеры', () => {
    const { client, net, onDisconnect } = setup()
    client.start()
    vi.advanceTimersByTime(0)
    lastSocket().open()
    lastSocket().drop()
    vi.advanceTimersByTime(1000)
    lastSocket().open()

    client.stop()

    expect(lastSocket().closed).toBe(true)
    expect(net.listenerCount()).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(client.getStatus()).toEqual({ kind: 'idle' })

    lastSocket().drop()
    expect(onDisconnect).toHaveBeenCalledTimes(1)
  })

  it('stop во время ожидания повтора отменяет его', () => {
    const { client } = setup()
    client.start()
    vi.advanceTimersByTime(0)
    lastSocket().drop()
    client.stop()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.instances).toHaveLength(1)
  })
})
