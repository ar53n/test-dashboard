import type { OrgNode } from '../../../shared/contract.ts'

/** mulberry32 — маленький детерминированный PRNG, чтобы данные были одинаковыми между запусками. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DIVISIONS: Record<string, string[]> = {
  'Технологии': ['Платформа', 'Мобильная разработка', 'Данные и аналитика', 'Информационная безопасность'],
  'Продажи': ['Корпоративные клиенты', 'Малый бизнес', 'Партнёрская сеть'],
  'Операции': ['Логистика', 'Закупки', 'Клиентская поддержка', 'Контроль качества'],
  'Финансы и персонал': ['Бухгалтерия', 'Финансовое планирование', 'HR и рекрутинг'],
}

const TEAM_SUFFIXES = ['Альфа', 'Бета', 'Гамма', 'Дельта', 'Эпсилон']

const BASE_DATE = Date.UTC(2026, 8, 1)

export function generateOrgTree(seed = 42): OrgNode[] {
  const random = createRandom(seed)
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))
  const updatedAt = () => new Date(BASE_DATE + int(0, 14 * 24 * 3600) * 1000).toISOString()

  const nodes: OrgNode[] = []
  let divisionIndex = 0

  for (const [divisionName, departments] of Object.entries(DIVISIONS)) {
    divisionIndex += 1
    const divisionId = `div-${divisionIndex}`
    nodes.push({
      id: divisionId,
      name: divisionName,
      parentId: null,
      headcount: int(2, 6),
      budget: int(8, 20) * 1_000_000,
      performance: int(60, 90),
      updatedAt: updatedAt(),
    })

    departments.forEach((departmentName, departmentOffset) => {
      const departmentId = `${divisionId}-dep-${departmentOffset + 1}`
      nodes.push({
        id: departmentId,
        name: departmentName,
        parentId: divisionId,
        headcount: int(1, 4),
        budget: int(3, 9) * 1_000_000,
        performance: int(50, 95),
        updatedAt: updatedAt(),
      })

      const teamCount = int(3, 5)
      for (let t = 0; t < teamCount; t += 1) {
        nodes.push({
          id: `${departmentId}-team-${t + 1}`,
          name: `${departmentName}: команда «${TEAM_SUFFIXES[t]}»`,
          parentId: departmentId,
          headcount: int(4, 18),
          budget: int(40, 260) * 100_000 + int(0, 99_999),
          performance: int(35, 99),
          updatedAt: updatedAt(),
        })
      }
    })
  }

  return nodes
}
