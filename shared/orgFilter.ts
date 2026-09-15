/**
 * Структурированный фильтр AI-поиска: контракт `POST /api/ai-search`.
 * Схема общая для сервера (валидация ответа модели) и клиента (валидация ответа API).
 */
import { z } from 'zod'

export const AI_QUERY_MAX_LENGTH = 300
export const FILTER_TEXT_MAX_LENGTH = 100
export const FILTER_MAX_METRICS = 5
export const FILTER_MAX_LIMIT = 100

export const METRIC_FIELDS = ['totalHeadcount', 'totalBudget', 'avgPerformance', 'headcount', 'budget', 'performance'] as const
export const SORT_KEYS = ['name', 'level', 'totalHeadcount', 'totalBudget', 'avgPerformance'] as const
export const COMPARISON_OPS = ['gt', 'gte', 'lt', 'lte'] as const
/** 1 — дивизион, 2 — отдел, 3 — команда. */
export const LEVELS = [1, 2, 3] as const

export type MetricField = (typeof METRIC_FIELDS)[number]
export type FilterSortKey = (typeof SORT_KEYS)[number]
export type ComparisonOp = (typeof COMPARISON_OPS)[number]

const PERCENT_FIELDS: ReadonlySet<MetricField> = new Set(['performance', 'avgPerformance'])

const textSchema = z.string().trim().min(1).max(FILTER_TEXT_MAX_LENGTH)

export const metricConditionSchema = z
  .strictObject({
    field: z.enum(METRIC_FIELDS),
    op: z.enum(COMPARISON_OPS),
    value: z.number().finite().nonnegative(),
  })
  .refine((condition) => !PERCENT_FIELDS.has(condition.field) || condition.value <= 100, {
    message: 'Эффективность — от 0 до 100',
    path: ['value'],
  })

export const orgFilterSchema = z.strictObject({
  nameContains: textSchema.optional(),
  /** Подстрока имени любого предка. */
  ancestorName: textSchema.optional(),
  levels: z
    .array(z.union(LEVELS.map((level) => z.literal(level))))
    .min(1)
    .refine((levels) => new Set(levels).size === levels.length, { message: 'Уровни не должны повторяться' })
    .optional(),
  metrics: z.array(metricConditionSchema).min(1).max(FILTER_MAX_METRICS).optional(),
  sort: z.strictObject({ key: z.enum(SORT_KEYS), dir: z.enum(['asc', 'desc']) }).optional(),
  limit: z.number().int().min(1).max(FILTER_MAX_LIMIT).optional(),
})

export type MetricCondition = z.infer<typeof metricConditionSchema>
export type OrgFilter = z.infer<typeof orgFilterSchema>

export const aiSearchRequestSchema = z.strictObject({
  query: z.string().trim().min(1).max(AI_QUERY_MAX_LENGTH),
})

export type AiSearchRequest = z.infer<typeof aiSearchRequestSchema>

export interface AiSearchResponse {
  filter: OrgFilter
}

export type AiSearchErrorCode =
  | 'bad_request'
  | 'not_configured'
  | 'rate_limited'
  | 'upstream_error'
  | 'invalid_model_output'
  | 'timeout'

export interface AiSearchErrorResponse {
  error: AiSearchErrorCode
  message: string
}
