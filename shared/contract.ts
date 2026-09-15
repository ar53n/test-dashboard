/**
 * Контракт между сервером и клиентом. Только типы: `import type` стирается
 * и на сервере (Node type stripping), и в клиентской сборке.
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
