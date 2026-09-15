import { HEARTBEAT_INTERVAL_MS, type ServerMessage } from '@shared/contract.ts'
import { getBackoffDelay } from './backoff.ts'
import { parseServerMessage } from './protocol.ts'

export type ConnectionStatus =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'open' }
  /** `attempt` — номер предстоящей попытки, `retryAt` — время попытки (ms epoch), `delayMs` — выбранная задержка. */
  | { kind: 'reconnecting'; attempt: number; retryAt: number; delayMs: number }
  | { kind: 'offline' }

/** Подмножество браузерного WebSocket, которое использует клиент (подменяется в тестах). */
export type SocketLike = Pick<WebSocket, 'onopen' | 'onmessage' | 'onclose' | 'onerror' | 'close'>

export interface NetworkMonitor {
  isOnline(): boolean
  subscribe(onOnline: () => void, onOffline: () => void): () => void
}

export interface LiveClientOptions {
  url: string
  onMessage: (message: ServerMessage) => void
  /** Соединение потеряно (закрыто сервером, сетью, по таймауту установки или тишины). */
  onDisconnect: () => void
  createSocket?: (url: string) => SocketLike
  network?: NetworkMonitor
  random?: () => number
  now?: () => number
  /** Сколько можно не получать сообщений, прежде чем считать соединение мёртвым. */
  idleTimeoutMs?: number
  /** Сколько ждать `open`: зависший handshake иначе держал бы клиент в `connecting` до таймаута браузера. */
  connectTimeoutMs?: number
}

export const browserNetwork: NetworkMonitor = {
  isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  subscribe(onOnline, onOffline) {
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  },
}

/**
 * WebSocket-клиент без React: переподключение с экспоненциальным backoff и jitter,
 * счётчик попыток сбрасывается после `hello`, мгновенное переподключение при
 * возвращении сети, таймаут установки соединения и таймаут тишины (heartbeat сервера не пришёл трижды).
 * `start()`/`stop()` идемпотентны и повторяемы — безопасно для StrictMode.
 */
export class LiveClient {
  readonly #options: Required<Omit<LiveClientOptions, 'url' | 'onMessage' | 'onDisconnect'>> & LiveClientOptions
  #status: ConnectionStatus = { kind: 'idle' }
  #listeners = new Set<() => void>()
  #running = false
  #socket: SocketLike | null = null
  #failedAttempts = 0
  #retryTimer: ReturnType<typeof setTimeout> | undefined
  /** До `open` — таймаут установки соединения, после — таймаут тишины. */
  #watchdogTimer: ReturnType<typeof setTimeout> | undefined
  #unsubscribeNetwork: (() => void) | undefined

  constructor(options: LiveClientOptions) {
    this.#options = {
      createSocket: (url) => new WebSocket(url),
      network: browserNetwork,
      random: Math.random,
      now: Date.now,
      idleTimeoutMs: HEARTBEAT_INTERVAL_MS * 3,
      connectTimeoutMs: 10_000,
      ...options,
    }
  }

  getStatus = (): ConnectionStatus => this.#status

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  start() {
    if (this.#running) return
    this.#running = true
    const { network } = this.#options
    this.#unsubscribeNetwork = network.subscribe(this.#handleOnline, this.#handleOffline)
    if (!network.isOnline()) {
      this.#setStatus({ kind: 'offline' })
      return
    }
    this.#setStatus({ kind: 'connecting' })
    // Подключение откладывается на макрозадачу: при двойном монтировании StrictMode
    // stop() успевает отменить его, и сокет не закрывается в состоянии CONNECTING.
    this.#retryTimer = setTimeout(this.#connect, 0)
  }

  stop() {
    if (!this.#running) return
    this.#running = false
    this.#unsubscribeNetwork?.()
    clearTimeout(this.#retryTimer)
    clearTimeout(this.#watchdogTimer)
    this.#detachSocket()
    this.#failedAttempts = 0
    this.#setStatus({ kind: 'idle' })
  }

  #connect = () => {
    clearTimeout(this.#retryTimer)
    if (!this.#running) return
    this.#setStatus({ kind: 'connecting' })

    let socket: SocketLike
    try {
      socket = this.#options.createSocket(this.#options.url)
    } catch {
      this.#scheduleReconnect()
      return
    }
    this.#socket = socket
    this.#armWatchdog(this.#options.connectTimeoutMs, 'соединение не установилось вовремя')

    socket.onopen = () => {
      if (socket !== this.#socket) return
      this.#setStatus({ kind: 'open' })
      this.#armIdleWatchdog()
    }
    socket.onmessage = (event) => {
      if (socket !== this.#socket) return
      this.#armIdleWatchdog()
      const message = parseServerMessage(event.data)
      if (!message) {
        console.warn('[live] сообщение не соответствует протоколу, пропущено')
        return
      }
      if (message.type === 'hello') this.#failedAttempts = 0
      this.#options.onMessage(message)
    }
    // Ошибка всегда сопровождается close, обрабатываем только его.
    socket.onerror = () => {}
    socket.onclose = () => {
      if (socket === this.#socket) this.#handleConnectionLost()
    }
  }

  #handleConnectionLost() {
    this.#detachSocket()
    clearTimeout(this.#watchdogTimer)
    this.#options.onDisconnect()
    if (!this.#running) return
    if (!this.#options.network.isOnline()) {
      this.#setStatus({ kind: 'offline' })
      return
    }
    this.#scheduleReconnect()
  }

  #scheduleReconnect() {
    const delay = getBackoffDelay(this.#failedAttempts, this.#options.random)
    this.#failedAttempts += 1
    this.#setStatus({
      kind: 'reconnecting',
      attempt: this.#failedAttempts,
      retryAt: this.#options.now() + delay,
      delayMs: delay,
    })
    this.#retryTimer = setTimeout(this.#connect, delay)
  }

  #handleOnline = () => {
    if (!this.#running || this.#socket) return
    this.#failedAttempts = 0
    this.#connect()
  }

  #handleOffline = () => {
    if (!this.#running) return
    if (this.#socket) {
      // Браузер может долго держать «мёртвый» сокет открытым — закрываем сами.
      this.#handleConnectionLost()
      return
    }
    clearTimeout(this.#retryTimer)
    this.#setStatus({ kind: 'offline' })
  }

  #armIdleWatchdog() {
    this.#armWatchdog(this.#options.idleTimeoutMs, 'нет сообщений от сервера')
  }

  #armWatchdog(timeoutMs: number, reason: string) {
    clearTimeout(this.#watchdogTimer)
    this.#watchdogTimer = setTimeout(() => {
      console.warn(`[live] ${reason}, переподключаемся`)
      this.#handleConnectionLost()
    }, timeoutMs)
  }

  /** Отвязывает обработчики до close(), чтобы события старого сокета не влияли на новый. */
  #detachSocket() {
    const socket = this.#socket
    if (!socket) return
    this.#socket = null
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null
    try {
      socket.close(1000, 'client closed')
    } catch {
      // Сокет уже закрыт.
    }
  }

  #setStatus(status: ConnectionStatus) {
    this.#status = status
    for (const listener of this.#listeners) listener()
  }
}
