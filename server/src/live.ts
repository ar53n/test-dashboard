import type { IncomingMessage, Server } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocket, WebSocketServer } from 'ws'
import { HEARTBEAT_INTERVAL_MS, LIVE_PATH, type ServerMessage } from '../../shared/contract.ts'
import type { OrgStore } from './store.ts'

/** Клиент, не успевающий читать сообщения, отключается: он переподключится и сделает resync. */
const MAX_BUFFERED_BYTES = 1024 * 1024

export interface LiveServerOptions {
  heartbeatIntervalMs?: number
}

function pathnameOf(req: IncomingMessage): string | null {
  try {
    return new URL(req.url ?? '/', 'http://localhost').pathname
  } catch {
    return null
  }
}

/**
 * WebSocket `/api/live` поверх существующего HTTP-сервера.
 * При подключении — `hello` с текущей версией, затем патчи из хранилища и `heartbeat`.
 */
export function attachLiveServer(server: Server, store: OrgStore, { heartbeatIntervalMs = HEARTBEAT_INTERVAL_MS }: LiveServerOptions = {}) {
  const wss = new WebSocketServer({ noServer: true })
  const alive = new WeakMap<WebSocket, boolean>()

  const send = (socket: WebSocket, message: ServerMessage) => {
    if (socket.readyState !== WebSocket.OPEN) return
    if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      socket.terminate()
      return
    }
    socket.send(JSON.stringify(message))
  }

  const broadcast = (message: ServerMessage) => {
    for (const socket of wss.clients) send(socket, message)
  }

  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (pathnameOf(req) !== LIVE_PATH) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  }
  server.on('upgrade', onUpgrade)

  wss.on('connection', (socket) => {
    alive.set(socket, true)
    socket.on('pong', () => alive.set(socket, true))
    socket.on('error', (error) => console.warn('[live] socket error', error.message))
    send(socket, { type: 'hello', epoch: store.epoch, revision: store.revision })
  })

  const unsubscribe = store.subscribe((patch) => broadcast(patch))

  // Прикладной heartbeat виден браузерному JS; ping/pong протокола — только серверу,
  // он нужен, чтобы закрывать соединения клиентов, пропавших без закрытия сокета.
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.get(socket)) {
        socket.terminate()
        continue
      }
      alive.set(socket, false)
      socket.ping()
    }
    broadcast({ type: 'heartbeat', epoch: store.epoch, revision: store.revision, serverTime: new Date().toISOString() })
  }, heartbeatIntervalMs)

  return {
    get clientCount() {
      return wss.clients.size
    },
    close() {
      clearInterval(heartbeat)
      unsubscribe()
      server.off('upgrade', onUpgrade)
      for (const socket of wss.clients) socket.terminate()
      wss.close()
    },
  }
}
