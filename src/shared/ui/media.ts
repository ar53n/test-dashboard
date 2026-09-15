/**
 * Media queries, общие для CSS и JS (`useMediaQuery`), чтобы раскладка и логика рендера
 * переключались на одной и той же ширине.
 */
export const media = {
  /** Дерево и таблица рядом. */
  split: '(min-width: 1280px)',
  narrow: '(max-width: 640px)',
} as const
