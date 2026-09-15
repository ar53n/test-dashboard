import type { NodeChange, PatchMessage, ServerMessage } from '@shared/contract.ts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyPatch } from '@/entities/org/model/applyPatch.ts'
import { createOrgModel, type OrgModel } from '@/entities/org/model/orgModel.ts'
import { makeNode } from '@/entities/org/model/testUtils.ts'
import { SyncController, type SyncTarget } from './SyncController.ts'

const at = '2026-09-15T10:00:00.000Z'

/** Снимок сервера на ревизии `revision`: численность команды равна номеру ревизии. */
const snapshotAt = (revision: number, epoch = 'e1'): OrgModel =>
  createOrgModel([makeNode('div', null), makeNode('team', 'div', { headcount: revision })], { epoch, revision })

const patch = (revision: number, epoch = 'e1', changes?: NodeChange[]): PatchMessage => ({
  type: 'patch',
  epoch,
  revision,
  changes: changes ?? [{ id: 'team', headcount: revision, updatedAt: at }],
})
const hello = (revision: number, epoch = 'e1'): ServerMessage => ({ type: 'hello', epoch, revision })
const heartbeat = (revision: number, epoch = 'e1'): ServerMessage => ({
  type: 'heartbeat',
  epoch,
  revision,
  serverTime: at,
})

/** Цель синхронизации в памяти: запросы снимков разрешаются вручную. */
function createHarness(initial: OrgModel | undefined, options: { maxQueueSize?: number } = {}) {
  let model = initial
  const modelListeners = new Set<() => void>()
  const pending: { resolve: (snapshot: OrgModel) => void; reject: () => void }[] = []

  const setModel = (next: OrgModel) => {
    model = next
    modelListeners.forEach((listener) => listener())
  }

  const target = {
    getModel: () => model,
    applyPatch: vi.fn((message: PatchMessage) => setModel(applyPatch(model!, message))),
    fetchSnapshot: vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          pending.push({
            resolve: (snapshot) => {
              setModel(snapshot)
              resolve()
            },
            reject: () => reject(new Error('network')),
          })
        }),
    ),
    subscribeModel: (listener: () => void) => {
      modelListeners.add(listener)
      return () => modelListeners.delete(listener)
    },
    setPushed: vi.fn(),
  } satisfies SyncTarget

  const controller = new SyncController(target, { random: () => 0, ...options })
  controller.start()

  return {
    controller,
    target,
    setModel,
    headcount: () => model?.nodes.get('team')?.headcount,
    revision: () => model?.version?.revision,
    epoch: () => model?.version?.epoch,
    /** Разрешает самый старый ожидающий запрос снимка и ждёт обработки. */
    async resolveSnapshot(snapshot: OrgModel) {
      pending.shift()!.resolve(snapshot)
      await vi.advanceTimersByTimeAsync(0)
    },
    async rejectSnapshot() {
      pending.shift()!.reject()
      await vi.advanceTimersByTimeAsync(0)
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('SyncController: live', () => {
  it('hello с версией модели — live без запроса; патчи применяются по порядку', () => {
    const h = createHarness(snapshotAt(10))
    h.controller.handleMessage(hello(10))
    expect(h.controller.getPhase()).toBe('live')
    expect(h.target.setPushed).toHaveBeenLastCalledWith(true)

    h.controller.handleMessage(patch(11))
    h.controller.handleMessage(patch(12))
    expect(h.headcount()).toBe(12)
    expect(h.target.fetchSnapshot).not.toHaveBeenCalled()
  })

  it('дубликат и старый патч отбрасываются без запроса снимка', () => {
    const h = createHarness(snapshotAt(10))
    h.controller.handleMessage(hello(10))
    h.controller.handleMessage(patch(11))
    h.controller.handleMessage(patch(11))
    h.controller.handleMessage(patch(9))

    expect(h.target.applyPatch).toHaveBeenCalledTimes(1)
    expect(h.target.fetchSnapshot).not.toHaveBeenCalled()
    expect(h.controller.getPhase()).toBe('live')
  })

  it('heartbeat с той же версией ничего не делает, с опережающей — запускает resync', () => {
    const h = createHarness(snapshotAt(10))
    h.controller.handleMessage(hello(10))
    h.controller.handleMessage(heartbeat(10))
    expect(h.target.fetchSnapshot).not.toHaveBeenCalled()

    h.controller.handleMessage(heartbeat(11))
    expect(h.controller.getPhase()).toBe('resyncing')
    expect(h.target.setPushed).toHaveBeenLastCalledWith(false)
    expect(h.target.fetchSnapshot).toHaveBeenCalledTimes(1)
  })

  it('hello и heartbeat старше модели того же epoch — синхронно: снимок обогнал сообщения в сокете', () => {
    const h = createHarness(snapshotAt(10))
    // Модель уже на rev 12 (снимок пришёл раньше), а hello и heartbeat из сокета отстают.
    h.setModel(snapshotAt(12))
    h.controller.handleMessage(hello(10))
    expect(h.controller.getPhase()).toBe('live')

    h.controller.handleMessage(heartbeat(11))
    expect(h.controller.getPhase()).toBe('live')
    expect(h.target.fetchSnapshot).not.toHaveBeenCalled()

    // Патчи, догоняющие модель, отбрасываются; следующий применяется.
    h.controller.handleMessage(patch(11))
    h.controller.handleMessage(patch(12))
    h.controller.handleMessage(patch(13))
    expect(h.target.applyPatch).toHaveBeenCalledTimes(1)
    expect(h.headcount()).toBe(13)
    expect(h.target.fetchSnapshot).not.toHaveBeenCalled()
  })

  it('патч, не согласующийся с моделью, запускает resync', () => {
    const h = createHarness(snapshotAt(10))
    h.controller.handleMessage(hello(10))
    h.controller.handleMessage(patch(11, 'e1', [{ id: 'ghost', headcount: 1, updatedAt: at }]))
    expect(h.controller.getPhase()).toBe('resyncing')
    expect(h.target.fetchSnapshot).toHaveBeenCalledTimes(1)
  })
})

describe('SyncController: resync', () => {
  it('rev 10 + патч 12 → resync; патч 13 во время запроса → снимок rev 12 → патч 13 применён', async () => {
    const h = createHarness(snapshotAt(10))
    h.controller.handleMessage(hello(10))

    h.controller.handleMessage(patch(12))
    expect(h.controller.getPhase()).toBe('resyncing')
    expect(h.target.applyPatch).not.toHaveBeenCalled()

    h.controller.handleMessage(patch(13))
    expect(h.target.fetchSnapshot).toHaveBeenCalledTimes(1)

    await h.resolveSnapshot(snapshotAt(12))
    expect(h.headcount()).toBe(13)
    expect(h.revision()).toBe(13)
    expect(h.controller.getPhase()).toBe('live')
    expect(h.target.fetchSnapshot).toHaveBeenCalledTimes(1)
  })

  it('снимок новее всех патчей из очереди: патчи отбрасываются, модель — снимок', async () => {
    const h = createHarness(snapshotAt(10))
    h.controller.handleMessage(hello(10))
    h.controller.handleMessage(patch(12))
    h.controller.handleMessage(patch(13))

    await h.resolveSnapshot(snapshotAt(15))
    expect(h.target.applyPatch).not.toHaveBeenCalled()
    expect(h.revision()).toBe(15)
    expect(h.controller.getPhase()).toBe('live')

    // Патчи 14 и 15, которые были в пути, приходят после снимка и отбрасываются.
    h.controller.handleMessage(patch(14))
    h.controller.handleMessage(patch(15))
    h.controller.handleMessage(patch(16))
    expect(h.target.applyPatch).toHaveBeenCalledTimes(1)
    expect(h.headcount()).toBe(16)
  })

  it('рестарт сервера: другой epoch с тем же номером ревизии → resync', async () => {
    const h = createHarness(snapshotAt(10, 'e1'))
    h.controller.handleMessage(hello(10, 'e1'))
    h.controller.handleMessage(hello(10, 'e2'))
    expect(h.controller.getPhase()).toBe('resyncing')
    h.controller.handleMessage(patch(11, 'e2'))

    await h.resolveSnapshot(snapshotAt(10, 'e2'))
    expect(h.target.fetchSnapshot).toHaveBeenCalledTimes(1)
    expect(h.epoch()).toBe('e2')
    expect(h.revision()).toBe(11)
    expect(h.controller.getPhase()).toBe('live')
  })

  it('рестарт сервера во время resync: патчи старого epoch из очереди отбрасываются', async () => {
    const h = createHarness(snapshotAt(10, 'e1'))
    h.controller.handleMessage(hello(10, 'e1'))
    h.controller.handleMessage(patch(12, 'e1'))
    h.controller.handleDisconnect()
    h.controller.handleMessage(hello(3, 'e2'))
    h.controller.handleMessage(patch(4, 'e2'))

    // Запрос, начатый до рестарта, вернул снимок нового запуска.
    await h.resolveSnapshot(snapshotAt(3, 'e2'))
    expect(h.target.applyPatch.mock.calls.map(([message]) => `${message.epoch}:${message.revision}`)).toEqual(['e2:4'])
    expect(h.revision()).toBe(4)
    expect(h.controller.getPhase()).toBe('live')
  })

  it('снимок оказался из старого epoch — повторный запрос', async () => {
    const h = createHarness(snapshotAt(10, 'e1'))
    h.controller.handleMessage(hello(10, 'e1'))
    h.controller.handleMessage(hello(2, 'e2'))
    await h.resolveSnapshot(snapshotAt(11, 'e1'))
    expect(h.controller.getPhase()).toBe('resyncing')

    await vi.advanceTimersByTimeAsync(500)
    await h.resolveSnapshot(snapshotAt(2, 'e2'))
    expect(h.target.fetchSnapshot).toHaveBeenCalledTimes(2)
    expect(h.controller.getPhase()).toBe('live')
  })

  it('переполнение очереди теряет старые патчи → повторный resync с backoff', async () => {
    const h = createHarness(snapshotAt(10), { maxQueueSize: 3 })
    h.controller.handleMessage(hello(10))
    h.controller.handleMessage(patch(12))
    for (let revision = 13; revision <= 20; revision += 1) h.controller.handleMessage(patch(revision))

    // Снимок rev 12, в очереди остались только 18–20: разрыв 13–17.
    await h.resolveSnapshot(snapshotAt(12))
    expect(h.revision()).toBe(12)
    expect(h.controller.getPhase()).toBe('resyncing')
    expect(h.target.fetchSnapshot).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(499)
    expect(h.target.fetchSnapshot).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(h.target.fetchSnapshot).toHaveBeenCalledTimes(2)

    await h.resolveSnapshot(snapshotAt(17))
    expect(h.revision()).toBe(20)
    expect(h.controller.getPhase()).toBe('live')
  })

  it('ошибка запроса снимка → повтор с растущей задержкой; обрыв соединения останавливает повторы', async () => {
    const h = createHarness(snapshotAt(10))
    h.controller.handleMessage(hello(10))
    h.controller.handleMessage(heartbeat(11))

    await h.rejectSnapshot()
    await vi.advanceTimersByTimeAsync(500)
    expect(h.target.fetchSnapshot).toHaveBeenCalledTimes(2)

    await h.rejectSnapshot()
    await vi.advanceTimersByTimeAsync(999)
    expect(h.target.fetchSnapshot).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(h.target.fetchSnapshot).toHaveBeenCalledTimes(3)

    await h.rejectSnapshot()
    h.controller.handleDisconnect()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(h.target.fetchSnapshot).toHaveBeenCalledTimes(3)
    expect(h.controller.getPhase()).toBe('waiting')
  })

  it('обрыв во время запроса снимка: после ответа — waiting, не live', async () => {
    const h = createHarness(snapshotAt(10))
    h.controller.handleMessage(hello(10))
    h.controller.handleMessage(heartbeat(11))
    h.controller.handleDisconnect()
    expect(h.controller.getPhase()).toBe('resyncing')

    await h.resolveSnapshot(snapshotAt(11))
    expect(h.controller.getPhase()).toBe('waiting')
    expect(h.target.setPushed).toHaveBeenLastCalledWith(false)
  })

  it('первая загрузка: патчи до данных ждут в очереди, свой запрос не делается', async () => {
    const h = createHarness(undefined)
    h.controller.handleMessage(hello(5))
    h.controller.handleMessage(patch(6))
    expect(h.controller.getPhase()).toBe('resyncing')

    h.setModel(snapshotAt(5))
    await vi.advanceTimersByTimeAsync(0)

    expect(h.target.fetchSnapshot).not.toHaveBeenCalled()
    expect(h.headcount()).toBe(6)
    expect(h.controller.getPhase()).toBe('live')
  })
})

describe('SyncController: stop', () => {
  it('очищает очередь и таймеры, снимает push-режим; ответы после stop игнорируются', async () => {
    const h = createHarness(snapshotAt(10))
    h.controller.handleMessage(hello(10))
    h.controller.handleMessage(patch(12))
    h.controller.stop()

    expect(h.controller.getPhase()).toBe('waiting')
    expect(h.target.setPushed).toHaveBeenLastCalledWith(false)
    expect(vi.getTimerCount()).toBe(0)

    await h.resolveSnapshot(snapshotAt(12))
    expect(h.target.applyPatch).not.toHaveBeenCalled()
    h.controller.handleMessage(patch(13))
    expect(h.target.applyPatch).not.toHaveBeenCalled()
  })
})
