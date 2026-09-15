import {
  COMPARISON_OPS,
  FILTER_MAX_LIMIT,
  LEVELS,
  METRIC_FIELDS,
  orgFilterSchema,
  SORT_KEYS,
  type OrgFilter,
} from '../../../shared/orgFilter.ts'

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] })

/**
 * JSON Schema для `response_format: json_schema` в strict-режиме: все поля обязательны,
 * `additionalProperties: false`, отсутствие условия — `null`. Итоговые ограничения
 * (длины, дубликаты, 0–100 для эффективности) проверяет `orgFilterSchema` после ответа.
 */
export const MODEL_FILTER_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['nameContains', 'ancestorName', 'levels', 'metrics', 'sort', 'limit'],
  properties: {
    nameContains: nullable({ type: 'string' }),
    ancestorName: nullable({ type: 'string' }),
    levels: nullable({ type: 'array', items: { type: 'integer', enum: [...LEVELS] } }),
    metrics: nullable({
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['field', 'op', 'value'],
        properties: {
          field: { type: 'string', enum: [...METRIC_FIELDS] },
          op: { type: 'string', enum: [...COMPARISON_OPS] },
          value: { type: 'number', minimum: 0 },
        },
      },
    }),
    sort: nullable({
      type: 'object',
      additionalProperties: false,
      required: ['key', 'dir'],
      properties: {
        key: { type: 'string', enum: [...SORT_KEYS] },
        dir: { type: 'string', enum: ['asc', 'desc'] },
      },
    }),
    limit: nullable({ type: 'integer', minimum: 1, maximum: FILTER_MAX_LIMIT }),
  },
} as const

export type FilterParseResult = { ok: true; filter: OrgFilter } | { ok: false; issues: string[] }

/**
 * Превращает ответ модели в `OrgFilter`: `null`, пустые строки и пустые массивы означают
 * «условия нет», повторы уровней схлопываются. Всё остальное должно пройти схему контракта.
 */
export function filterFromModelOutput(content: unknown): FilterParseResult {
  let raw: unknown
  try {
    raw = typeof content === 'string' ? JSON.parse(content) : content
  } catch {
    return { ok: false, issues: ['ответ модели — не JSON'] }
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, issues: ['ответ модели — не объект'] }
  }

  const normalized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value === null) continue
    if (typeof value === 'string' && value.trim() === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    normalized[key] = key === 'levels' && Array.isArray(value) ? [...new Set(value)] : value
  }

  const result = orgFilterSchema.safeParse(normalized)
  if (!result.success) {
    return { ok: false, issues: result.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.')}: ${issue.message}`) }
  }
  return { ok: true, filter: result.data }
}
