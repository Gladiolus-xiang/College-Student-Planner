import type { Activity, CourseSlot, PlanBlock } from '../types'

/**
 * 规则排期引擎。
 * 设计原则：时间约束、冲突检查、单日上限全部由代码保证，模型只负责解释和取舍建议。
 * 好处：模型挂了/胡说，排出来的计划依然合法可用。
 */

const DAY_START = 8 * 60
const DAY_END = 23 * 60
const MAX_DAILY_MIN = 240
const MIN_BLOCK = 30
const BREAKS: Array<[number, number]> = [
  [12 * 60, 13 * 60 + 30], // 午饭
  [17 * 60 + 30, 19 * 60], // 晚饭
]

export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const toHHMM = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export function dayKey(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

/** 同一块计划在不同渲染之间保持稳定标记 */
export function blockKey(block: PlanBlock): string {
  return `${block.activityId}@${block.date}@${block.start}`
}

/** 明天（用来做重排的起点） */
export function tomorrow(date = new Date()): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  return d
}

export function weekdayOf(date: Date): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const d = date.getDay()
  return (d === 0 ? 7 : d) as 1 | 2 | 3 | 4 | 5 | 6 | 7
}

/** 当天有哪些课，换算成分钟区间 */
function busyIntervals(date: Date, courses: CourseSlot[]): Array<[number, number]> {
  const wd = weekdayOf(date)
  return courses.filter((c) => c.weekday === wd).map((c) => [toMin(c.start), toMin(c.end)] as [number, number])
}

/** 当天还能用的空闲段（已扣掉课程、固定日程、午饭晚饭） */
export function freeSlots(
  date: Date,
  courses: CourseSlot[],
  extraBusy: Array<[number, number]> = [],
): Array<[number, number]> {
  const busy = [...busyIntervals(date, courses), ...extraBusy, ...BREAKS].sort((a, b) => a[0] - b[0])
  const slots: Array<[number, number]> = []
  let cursor = DAY_START

  for (const [start, end] of busy) {
    if (start > cursor) slots.push([cursor, Math.min(start, DAY_END)])
    cursor = Math.max(cursor, end)
  }
  if (cursor < DAY_END) slots.push([cursor, DAY_END])

  return slots.filter(([s, e]) => e - s >= MIN_BLOCK)
}

const deadlineTs = (a: Activity): number =>
  a.deadline ? new Date(a.deadline.replace(' ', 'T')).getTime() : Number.MAX_SAFE_INTEGER

/** 排序：先按优先级，再按截止时间 */
function orderOf(tasks: Activity[]): Activity[] {
  return [...tasks].sort((a, b) => a.priority - b.priority || deadlineTs(a) - deadlineTs(b))
}

function reasonFor(task: Activity, part: number, now: Date): string {
  if (part > 0) return `第 ${part + 1} 段，接着上次继续`
  if (!task.deadline) return '没有硬截止，按优先级插入空档'
  const hours = Math.round((deadlineTs(task) - now.getTime()) / 3_600_000)
  if (hours < 0) return '已过截止时间，建议今天补完'
  if (hours < 24) return '距截止不到 1 天，必须今天做完'
  return `距截止 ${Math.floor(hours / 24)} 天，提前推进`
}

export interface PlanOptions {
  days?: number
  from?: Date
  maxDailyMin?: number
  /** 用模型给的先后顺序覆盖默认排序（重排时用） */
  order?: string[]
  /** 覆盖每个任务还要多少分钟（已经做了一部分的情况） */
  remainingMin?: Record<string, number>
}

/** 固定日程的占用区间：截止时间就是到场时间 */
function fixedInterval(task: Activity): { date: string; start: number; end: number } | null {
  if (!task.deadline) return null
  const d = new Date(task.deadline.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return null
  const start = d.getHours() * 60 + d.getMinutes()
  return { date: dayKey(d), start, end: Math.min(DAY_END, start + Math.max(MIN_BLOCK, task.durationMin)) }
}

/** 把任务装进未来 N 天的空档，返回逐块计划 */
export function planTasks(
  tasks: Activity[],
  courses: CourseSlot[],
  options: PlanOptions = {},
): PlanBlock[] {
  const { days = 3, from = new Date(), maxDailyMin = MAX_DAILY_MIN, order, remainingMin } = options
  const now = new Date()

  const active = tasks.filter((t) => t.type !== 'course' && t.status !== 'done')
  const fixed = active
    .filter((t) => t.fixed)
    .map((task) => ({ task, slot: fixedInterval(task) }))
    .filter((x): x is { task: Activity; slot: { date: string; start: number; end: number } } => x.slot !== null)

  const flexible = active.filter((t) => !t.fixed && t.type !== 'habit')
  let queue: Activity[]
  if (order && order.length) {
    const byId = new Map(flexible.map((t) => [t.id, t]))
    const picked: Activity[] = []
    for (const id of order) {
      const task = byId.get(id)
      if (task && !picked.some((p) => p.id === task.id)) picked.push(task)
    }
    // 模型漏掉的任务补在末尾，不能凭空消失
    for (const task of flexible) if (!picked.some((p) => p.id === task.id)) picked.push(task)
    queue = picked
  } else {
    queue = orderOf(flexible)
  }

  const habits = active.filter((t) => t.type === 'habit')
  const remaining = new Map(
    queue.map((t) => [t.id, Math.max(MIN_BLOCK, remainingMin?.[t.id] ?? t.durationMin)]),
  )
  const blocks: PlanBlock[] = []

  for (let i = 0; i < days; i += 1) {
    const date = new Date(from)
    date.setDate(from.getDate() + i)
    const key = dayKey(date)

    const dayFixed = fixed.filter((f) => f.slot.date === key)
    for (const f of dayFixed) {
      blocks.push({
        date: key,
        activityId: f.task.id,
        start: toHHMM(f.slot.start),
        end: toHHMM(f.slot.end),
        reason: '固定日程，到点在场，不另排准备时间',
      })
    }

    const busy = dayFixed.map((f) => [f.slot.start, f.slot.end] as [number, number])
    let budget = maxDailyMin

    for (const [slotStart, slotEnd] of freeSlots(date, courses, busy)) {
      if (budget < MIN_BLOCK) break
      let cursor = slotStart

      for (const task of queue) {
        if (budget < MIN_BLOCK) break
        const left = remaining.get(task.id) ?? 0
        if (left < MIN_BLOCK) continue

        const chunk = Math.min(slotEnd - cursor, left, budget)
        if (chunk < MIN_BLOCK) break

        blocks.push({
          date: key,
          activityId: task.id,
          start: toHHMM(cursor),
          end: toHHMM(cursor + chunk),
          reason: reasonFor(task, blocks.filter((b) => b.activityId === task.id).length, now),
        })

        cursor += chunk
        budget -= chunk
        remaining.set(task.id, left - chunk)
        if (cursor >= slotEnd) break
      }
    }

    // 习惯类：每天都要做一次，优先放晚上 19:00 之后，不占 4 小时预算
    if (habits.length) {
      const used = blocks
        .filter((b) => b.date === key)
        .map((b) => [toMin(b.start), toMin(b.end)] as [number, number])
      const rest = freeSlots(date, courses, [...busy, ...used])
      const evening = rest.find(([start]) => start >= 19 * 60) ?? rest[rest.length - 1]
      if (evening) {
        let cursor = evening[0]
        for (const habit of habits) {
          const dur = Math.min(60, Math.max(MIN_BLOCK, habit.durationMin))
          if (cursor + dur > evening[1]) break
          blocks.push({
            date: key,
            activityId: habit.id,
            start: toHHMM(cursor),
            end: toHHMM(cursor + dur),
            reason: '每日固定，保持连续性',
          })
          cursor += dur
        }
      }
    }
  }

  return blocks
}

export interface DayPlan {
  date: string
  weekday: string
  blocks: Array<PlanBlock & { activity?: Activity }>
}

/** 按天分组，方便直接渲染 */
export function groupByDay(blocks: PlanBlock[], activities: Activity[]): DayPlan[] {
  const byId = new Map(activities.map((a) => [a.id, a]))
  const map = new Map<string, DayPlan>()

  for (const block of blocks) {
    if (!map.has(block.date)) {
      const d = new Date(`${block.date}T00:00:00`)
      map.set(block.date, {
        date: block.date,
        weekday: `周${'日一二三四五六'[d.getDay()]}`,
        blocks: [],
      })
    }
    map.get(block.date)!.blocks.push({ ...block, activity: byId.get(block.activityId) })
  }

  const days = [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
  for (const day of days) day.blocks.sort((a, b) => a.start.localeCompare(b.start))
  return days
}
