import type { PatchMessage, ServerMessage } from '@shared/contract.ts'
import type { OrgModel, OrgVersion } from '@/entities/org/model/orgModel.ts'
import { getBackoffDelay } from './backoff.ts'

/**
 * - `waiting` — нет соединения или ещё не пришёл `hello`; данные обновляются только HTTP (SWR).
 * - `resyncing` — модель разошлась с сервером: запрашивается снимок, патчи копятся в очереди.
 * - `live` — модель совпадает с сервером и обновляется патчами.
 */
export type SyncPhase = 'waiting' | 'resyncing' | 'live'

export interface SyncTarget {
  getModel(): OrgModel | undefined
  /** Применяет патч к модели в кэше; бросает, если патч не согласуется с моделью. */
  applyPatch(patch: PatchMessage): void
  /** Принудительно запрашивает свежий снимок; отклоняется при ошибке. */
  fetchSnapshot(): Promise<void>
  /** Модель в кэше обновилась (из любого источника). */
  subscribeModel(listener: () => void): () => void
  /** Данные поддерживаются push-обновлениями: HTTP-перепроверки не нужны. */
  setPushed(pushed: boolean): void
}

export interface SyncControllerOptions {
  maxQueueSize?: number
  random?: () => number
}

export const MAX_QUEUE_SIZE = 500

/**
 * Синхронизация модели в кэше с потоком патчей. Чистая логика без React и сети.
 *
 * Правила:
 * - патч с ревизией `model + 1` применяется, с ревизией `≤ model` — отбрасывается;
 * - hello/heartbeat с ревизией не новее модели того же epoch — синхронность (снимок мог обогнать сокет);
 * - разрыв ревизий, другой epoch, неприменимый патч или hello/heartbeat, опередивший модель,
 *   запускают resync: один запрос снимка, патчи на это время копятся в очереди;
 * - после снимка из очереди применяются патчи новее снимка; если модель всё ещё отстаёт
 *   от последней известной версии сервера — повторный resync с backoff;
 * - очередь ограничена: при переполнении отбрасываются самые старые патчи. Потерю
 *   обнаружит проверка разрыва, и последует ещё один resync.
 */
export class SyncController {
  readonly #target: SyncTarget
  readonly #maxQueueSize: number
  readonly #random: () => number

  #phase: SyncPhase = 'waiting'
  #listeners = new Set<() => void>()
  #running = false
  #connected = false
  /** Последняя версия, о которой сообщил сервер (по любому сообщению). */
  #serverVersion: OrgVersion | null = null
  #queue: PatchMessage[] = []
  #fetching = false
  #awaitingModel = false
  #retryAttempt = 0
  #retryTimer: ReturnType<typeof setTimeout> | undefined
  #unsubscribeModel: (() => void) | undefined

  constructor(target: SyncTarget, { maxQueueSize = MAX_QUEUE_SIZE, random = Math.random }: SyncControllerOptions = {}) {
    this.#target = target
    this.#maxQueueSize = maxQueueSize
    this.#random = random
  }

  getPhase = (): SyncPhase => this.#phase

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  start() {
    if (this.#running) return
    this.#running = true
    this.#unsubscribeModel = this.#target.subscribeModel(this.#handleModelChange)
  }

  stop() {
    if (!this.#running) return
    this.#running = false
    this.#unsubscribeModel?.()
    clearTimeout(this.#retryTimer)
    this.#retryTimer = undefined
    this.#queue = []
    this.#connected = false
    this.#serverVersion = null
    this.#awaitingModel = false
    this.#retryAttempt = 0
    this.#setPhase('waiting')
  }

  handleMessage(message: ServerMessage) {
    if (!this.#running) return
    this.#serverVersion = { epoch: message.epoch, revision: message.revision }
    if (message.type === 'hello') this.#connected = true

    if (this.#phase === 'resyncing') {
      if (message.type === 'patch') this.#enqueue(message)
      return
    }

    const current = this.#target.getModel()?.version
    if (!current || current.epoch !== message.epoch) {
      if (message.type === 'patch') this.#enqueue(message)
      this.#startResync()
      return
    }

    if (message.type !== 'patch') {
      // Ревизия ниже модели — не пропуск: HTTP-снимок мог обогнать сообщения, ещё идущие
      // по сокету. Отстающие патчи отбросятся как `≤ model`, как и в #drain().
      if (message.revision <= current.revision) this.#setPhase('live')
      else this.#startResync()
      return
    }

    if (message.revision <= current.revision) return
    if (message.revision !== current.revision + 1) {
      this.#enqueue(message)
      this.#startResync()
      return
    }

    try {
      this.#target.applyPatch(message)
      this.#setPhase('live')
    } catch (error) {
      console.warn('[live] патч не применился, запрашиваем снимок', error)
      this.#startResync()
    }
  }

  handleDisconnect() {
    if (!this.#running) return
    this.#connected = false
    clearTimeout(this.#retryTimer)
    this.#retryTimer = undefined
    // Идущий запрос снимка доводится до конца; повторы — только после нового hello.
    if (!this.#fetching) this.#setPhase('waiting')
  }

  #enqueue(patch: PatchMessage) {
    this.#queue.push(patch)
    if (this.#queue.length > this.#maxQueueSize) this.#queue.splice(0, this.#queue.length - this.#maxQueueSize)
  }

  #startResync() {
    this.#setPhase('resyncing')
    if (this.#fetching || this.#retryTimer !== undefined) return
    if (!this.#target.getModel()) {
      // Первая загрузка ещё идёт: данные придут через кэш, свой запрос не нужен.
      this.#awaitingModel = true
      return
    }
    this.#fetchSnapshot()
  }

  #fetchSnapshot() {
    this.#retryTimer = undefined
    this.#fetching = true
    this.#target.fetchSnapshot().then(
      () => {
        this.#fetching = false
        if (this.#running) this.#drain()
      },
      () => {
        this.#fetching = false
        if (this.#running) this.#scheduleRetry()
      },
    )
  }

  #handleModelChange = () => {
    if (!this.#awaitingModel || !this.#target.getModel()) return
    this.#awaitingModel = false
    if (this.#phase === 'resyncing' && !this.#fetching) this.#drain()
  }

  /** Применяет накопленные патчи поверх снимка и решает, совпала ли модель с сервером. */
  #drain() {
    const model = this.#target.getModel()
    if (!model) {
      this.#awaitingModel = true
      return
    }

    let current = model.version
    const serverEpoch = this.#serverVersion?.epoch
    const remaining: PatchMessage[] = []

    for (const patch of this.#queue) {
      if (patch.epoch !== serverEpoch) continue // патч прежнего запуска сервера
      if (!current || current.epoch !== patch.epoch || remaining.length > 0 || patch.revision > current.revision + 1) {
        remaining.push(patch)
        continue
      }
      if (patch.revision <= current.revision) continue
      try {
        this.#target.applyPatch(patch)
        current = this.#target.getModel()?.version ?? null
      } catch (error) {
        console.warn('[live] патч из очереди не применился', error)
      }
    }
    this.#queue = remaining

    const server = this.#serverVersion
    const inSync = !!current && !!server && current.epoch === server.epoch && current.revision >= server.revision

    if (!this.#connected) {
      this.#setPhase('waiting')
      return
    }
    if (inSync) {
      this.#retryAttempt = 0
      this.#queue = []
      this.#setPhase('live')
      return
    }
    this.#scheduleRetry()
  }

  #scheduleRetry() {
    if (!this.#connected) {
      this.#setPhase('waiting')
      return
    }
    this.#setPhase('resyncing')
    const delay = getBackoffDelay(this.#retryAttempt, this.#random)
    this.#retryAttempt += 1
    this.#retryTimer = setTimeout(() => this.#fetchSnapshot(), delay)
  }

  #setPhase(phase: SyncPhase) {
    this.#target.setPushed(phase === 'live')
    if (phase === this.#phase) return
    this.#phase = phase
    for (const listener of this.#listeners) listener()
  }
}
