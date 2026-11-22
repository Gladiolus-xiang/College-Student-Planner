import { chat, extractJson } from './api'
import {
  buildReasonMessages,
  buildReorderMessages,
  type PlanBlockInput,
  type ReorderTodo,
} from './prompts'

export interface PlanExplanation {
  reasons: Record<string, string>
  summary: string
}

/** 调 P2：给已排好的计划配人话理由。失败由调用方兜底（规则文案还在）。 */
export async function explainPlan(blocks: PlanBlockInput[], today: string): Promise<PlanExplanation> {
  const result = await chat(buildReasonMessages(blocks, today), { json: true, temperature: 0.6 })
  const parsed = extractJson<{ reasons?: Record<string, unknown>; summary?: unknown }>(result.content)

  const reasons: Record<string, string> = {}
  for (const block of blocks) {
    const raw = parsed.reasons?.[block.activityId]
    if (typeof raw === 'string' && raw.trim()) reasons[block.activityId] = raw.trim().slice(0, 60)
  }

  return {
    reasons,
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 80) : '',
  }
}

export interface ReorderResult {
  order: string[]
  reasons: Record<string, string>
  summary: string
}

/**
 * P3 重排：模型只给先后顺序，时间由引擎重新计算。
 * 模型漏掉的 id 一律补在末尾，保证没有任何任务凭空消失。
 */
export async function reorderPlan(args: {
  today: string
  done: string[]
  todo: ReorderTodo[]
  tomorrow: string
}): Promise<ReorderResult> {
  const result = await chat(buildReorderMessages(args), { json: true, temperature: 0.3 })
  const parsed = extractJson<{ order?: unknown; reasons?: Record<string, unknown>; summary?: unknown }>(
    result.content,
  )

  const valid = new Set(args.todo.map((t) => t.id))
  const order: string[] = []
  if (Array.isArray(parsed.order)) {
    for (const id of parsed.order) {
      if (typeof id === 'string' && valid.has(id) && !order.includes(id)) order.push(id)
    }
  }
  for (const item of args.todo) if (!order.includes(item.id)) order.push(item.id)

  const reasons: Record<string, string> = {}
  for (const [id, text] of Object.entries(parsed.reasons ?? {})) {
    if (typeof text === 'string' && text.trim()) reasons[id] = text.trim().slice(0, 60)
  }

  return {
    order,
    reasons,
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 90) : '',
  }
}
