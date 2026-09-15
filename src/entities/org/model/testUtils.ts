import type { OrgNode } from '@shared/contract.ts'

export function makeNode(id: string, parentId: string | null, overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    id,
    name: `Узел ${id}`,
    parentId,
    headcount: 10,
    budget: 1_000_000,
    performance: 50,
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}
