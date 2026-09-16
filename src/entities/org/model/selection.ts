/** Панель, в которой сделан выбор: она уже показывает узел и сама к нему не прокручивается. */
export type SelectionSource = 'tree' | 'table'

/** Выбранный узел, общий для дерева и сводной таблицы. */
export interface OrgSelection {
  readonly id: string
  /** Растёт при каждом выборе, в том числе повторном: соседняя панель заново прокручивает к узлу. */
  readonly request: number
  readonly source: SelectionSource
}
