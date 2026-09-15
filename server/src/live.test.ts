import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { LIVE_PATH, type ServerMessage } from '../../shared/contract.ts'
import { generateOrgTree } from './data/generate.ts'
import { createHttpServer } from './http.ts'
import { attachLiveServer } from './live.ts'
import { OrgStore } from './store.ts'

let store: OrgStore
let server: ReturnType<typeof createHttpServer>
let live: ReturnType<typeof attachLiveServer>
let port = 0
const sockets: WebSocket[] = []

beforeEach(async () => {
  store = new OrgStore(generateOrgTree())
  server = createHttpServer(store)
  live = attachLiveServer(server, store, { heartbeatIntervalMs: 50 })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  port = (server.address() as AddressInfo).port
})

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate()
  live.close()
  await new Promise((resolve) => server.close(resolve))
})

/** Подключается и копит сообщения; `next(type)` ждёт первое ещё не прочитанное сообщение нужного типа. */
function connect(path = LIVE_PATH) {
  const socket = new WebSocket(`ws://localhost:${port}${path}`)
  sockets.push(socket)
  const inbox: ServerMessage[] = []
  const waiters: (() => void)[] = []
  socket.on('message', (data) => {
    inbox.push(JSON.parse(String(data)) as ServerMessage)
    waiters.splice(0).forEach((wake) => wake())
  })

  const next = async <T extends ServerMessage['type']>(type: T): Promise<Extract<ServerMessage, { type: T }>> => {
    for (;;) {
      const index = inbox.findIndex((message) => message.type === type)
      if (index >= 0) return inbox.splice(index, 1)[0] as Extract<ServerMessage, { type: T }>
      await new Promise<void>((resolve) => waiters.push(resolve))
    }
  }
  return { socket, next }
}

describe('WebSocket /api/live', () => {
  it('при подключении присылает hello с текущей версией', async () => {
    store.update([{ id: 'div-1', headcount: 999 }])
    const client = connect()
    expect(await client.next('hello')).toEqual({ type: 'hello', epoch: store.epoch, revision: 1 })
  })

  it('рассылает патчи всем подключённым клиентам', async () => {
    const first = connect()
    const second = connect()
    await Promise.all([first.next('hello'), second.next('hello')])

    store.update([{ id: 'div-1', performance: 1 }])

    const [a, b] = await Promise.all([first.next('patch'), second.next('patch')])
    expect(a).toEqual(b)
    expect(a).toMatchObject({ epoch: store.epoch, revision: 1, changes: [{ id: 'div-1', performance: 1 }] })
  })

  it('шлёт heartbeat с версией состояния', async () => {
    const client = connect()
    await client.next('hello')
    const heartbeat = await client.next('heartbeat')
    expect(heartbeat).toMatchObject({ epoch: store.epoch, revision: 0 })
    expect(Number.isNaN(Date.parse(heartbeat.serverTime))).toBe(false)
  })

  it('отклоняет upgrade на другой путь', async () => {
    const { socket } = connect('/api/other')
    const error = await new Promise<Error>((resolve) => socket.on('error', resolve))
    expect(error.message).toContain('404')
  })

  it('сверх квоты соединений отвечает 503 и не занимает слот', async () => {
    live.close()
    live = attachLiveServer(server, store, { heartbeatIntervalMs: 50, maxClients: 1 })

    const first = connect()
    await first.next('hello')

    const { socket } = connect()
    const error = await new Promise<Error>((resolve) => socket.on('error', resolve))
    expect(error.message).toContain('503')
    expect(live.clientCount).toBe(1)
  })

  it('close() закрывает соединения клиентов', async () => {
    const client = connect()
    await client.next('hello')
    const closed = new Promise((resolve) => client.socket.on('close', resolve))
    live.close()
    await closed
    expect(live.clientCount).toBe(0)
  })
})
