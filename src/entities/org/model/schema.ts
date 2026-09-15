import type { OrgNode } from '@shared/contract.ts'
import { z } from 'zod'

export const orgNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  headcount: z.number().int().nonnegative(),
  budget: z.number().nonnegative(),
  performance: z.number().min(0).max(100),
  updatedAt: z.iso.datetime(),
}) satisfies z.ZodType<OrgNode>

export const orgTreeResponseSchema = z.array(orgNodeSchema)

/** Человекочитаемый список проблем для экрана ошибки и логов. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 5).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(корень)'
    return `${path}: ${issue.message}`
  })
}
