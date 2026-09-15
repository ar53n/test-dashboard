import type { OrgNode } from '@shared/contract.ts'
import { computeAggregates, type Aggregate } from './aggregate.ts'
import { buildIndex, type OrgIndex } from './buildIndex.ts'

/** Версия состояния. Ревизии сравнимы только внутри одного epoch (одного запуска сервера). */
export interface OrgVersion {
  readonly epoch: string
  readonly revision: number
}

/**
 * Производная модель, которая лежит в кэше запроса: индекс дерева и агрегаты.
 * `version === null` — ответ без версии (демо-сценарии); такой снимок не сравнивается с другими.
 */
export interface OrgModel extends OrgIndex {
  readonly version: OrgVersion | null
  readonly aggregates: ReadonlyMap<string, Aggregate>
}

export function createOrgModel(list: readonly OrgNode[], version: OrgVersion | null): OrgModel {
  const index = buildIndex(list)
  return { ...index, version, aggregates: computeAggregates(index) }
}

export type VersionOrder = 'older' | 'same' | 'newer' | 'incomparable'

/** Сравнивает `candidate` с `current`. Разные epoch или отсутствие версии — несравнимы. */
export function compareVersions(candidate: OrgVersion | null, current: OrgVersion | null): VersionOrder {
  if (!candidate || !current || candidate.epoch !== current.epoch) return 'incomparable'
  if (candidate.revision === current.revision) return 'same'
  return candidate.revision < current.revision ? 'older' : 'newer'
}

/**
 * Выбор между моделью в кэше и новым снимком: снимок той же или более старой ревизии
 * того же epoch не заменяет модель. Так не бывает лишнего ререндера, а запоздавший
 * HTTP-ответ не откатывает изменения, уже применённые патчами.
 */
export function pickCurrentModel(current: OrgModel | undefined, next: OrgModel): OrgModel {
  if (!current) return next
  const order = compareVersions(next.version, current.version)
  return order === 'same' || order === 'older' ? current : next
}
