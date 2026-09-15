/**
 * Контракт между сервером и клиентом: типы и несколько констант протокола.
 * Файл импортируется и сервером (Node type stripping), и клиентской сборкой,
 * поэтому в нём только стираемый синтаксис.
 */

export interface OrgNode {
  id: string
  name: string
  parentId: string | null
  headcount: number
  budget: number
  /** 0–100 */
  performance: number
  /** ISO 8601 */
  updatedAt: string
}

/** Заголовки снимка `GET /api/org-tree`. Версия состояния = (epoch, revision). */
export const ORG_EPOCH_HEADER = 'X-Org-Epoch'
export const ORG_REVISION_HEADER = 'X-Org-Revision'

export const formatEtag = (epoch: string, revision: number): string => `"${epoch}-${revision}"`

// ─── Live-обновления: WebSocket `/api/live` ────────────────────────────────

export const LIVE_PATH = '/api/live'

/** Сервер шлёт heartbeat с этим интервалом; клиент считает соединение мёртвым после трёх пропусков. */
export const HEARTBEAT_INTERVAL_MS = 15_000

/** Поля, которые могут меняться патчем. Структура дерева (id, parentId) патчами не меняется. */
export type MutableNodeField = 'name' | 'headcount' | 'budget' | 'performance'

/** Изменение одного узла: только поля, значение которых действительно изменилось. */
export type NodeChange = { id: string; updatedAt: string } & Partial<Pick<OrgNode, MutableNodeField>>

/** Первое сообщение после подключения: текущая версия состояния сервера. */
export interface HelloMessage {
  type: 'hello'
  epoch: string
  revision: number
}

/** Пакет изменений; `revision` — ревизия после применения пакета, ровно на 1 больше предыдущей. */
export interface PatchMessage {
  type: 'patch'
  epoch: string
  revision: number
  changes: NodeChange[]
}

/** Сигнал жизни соединения и дешёвая сверка версии. */
export interface HeartbeatMessage {
  type: 'heartbeat'
  epoch: string
  revision: number
  /** ISO 8601 */
  serverTime: string
}

export type ServerMessage = HelloMessage | PatchMessage | HeartbeatMessage
