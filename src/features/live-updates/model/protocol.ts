import type { ServerMessage } from '@shared/contract.ts'
import { z } from 'zod'
import { orgNodeSchema } from '@/entities/org/model/schema.ts'

const versionShape = {
  epoch: z.string().min(1),
  revision: z.number().int().nonnegative(),
}

const nodeChangeSchema = z.object({
  id: orgNodeSchema.shape.id,
  updatedAt: orgNodeSchema.shape.updatedAt,
  name: orgNodeSchema.shape.name.optional(),
  headcount: orgNodeSchema.shape.headcount.optional(),
  budget: orgNodeSchema.shape.budget.optional(),
  performance: orgNodeSchema.shape.performance.optional(),
})

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello'), ...versionShape }),
  z.object({ type: z.literal('patch'), ...versionShape, changes: z.array(nodeChangeSchema).min(1) }),
  z.object({ type: z.literal('heartbeat'), ...versionShape, serverTime: z.iso.datetime() }),
]) satisfies z.ZodType<ServerMessage>

/** Разбирает и валидирует сообщение сервера; некорректное — `null`. */
export function parseServerMessage(data: unknown): ServerMessage | null {
  if (typeof data !== 'string') return null
  let json: unknown
  try {
    json = JSON.parse(data)
  } catch {
    return null
  }
  const result = serverMessageSchema.safeParse(json)
  return result.success ? result.data : null
}
