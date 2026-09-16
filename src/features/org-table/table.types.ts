import type { SortKey } from './model/rows.ts'

export type ColumnAlign = 'start' | 'end'

/** Описание столбца сводной таблицы: заголовок сортирует по `key`. */
export interface TableColumn {
  readonly key: SortKey
  readonly title: string
  readonly align: ColumnAlign
  /** Фиксированная ширина; без неё столбец забирает всё свободное место. */
  readonly width?: string
}
