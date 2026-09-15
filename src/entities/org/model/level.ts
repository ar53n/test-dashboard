const LEVEL_LABELS = ['Дивизион', 'Отдел', 'Команда']

/** Уровень в иерархии, начиная с 1: глубина 0 — дивизион. */
export const getLevel = (depth: number) => depth + 1

export function getLevelLabel(level: number): string {
  return LEVEL_LABELS[level - 1] ?? `Уровень ${level}`
}
