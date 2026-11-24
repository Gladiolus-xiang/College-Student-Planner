/**
 * 校验层：把模型吐出来的原始字段转成应用里的 Activity / CourseSlot。
 * 缺字段补默认值、时间格式归一、habit 的钟点单独收 —— 「把模型 JSON 直接落库」是不允许的。
 */
import type { Activity, ActivityType, CourseSlot } from '../types'
import { normalizeDeadline } from './time.ts'
import { uid } from './id.ts'

export interface RawActivity {
  title?: string
  type?: string
  deadline?: string | null
  durationMin?: number
  priority?: number
  remindBeforeMin?: number
  fixed?: boolean
  preferStart?: string
  note?: string
}

export interface RawCourse {
  name?: string
  weekday?: number
  start?: string
  end?: string
  note?: string
}

const TYPES: ActivityType[] = ['ddl', 'habit', 'course', 'goal']

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/

/** 模型给的 "20:00" 才收，其它一律当没给 */
function normalizeClock(input: unknown): string | undefined {
  const text = String(input ?? '').trim()
  return HHMM.test(text) ? text.padStart(5, '0') : undefined
}

export function normalizeActivities(raw: RawActivity[]): Activity[] {
  return raw
    .filter((item) => typeof item.title === 'string' && item.title.trim().length > 0)
    .map((item) => {
      const type = TYPES.includes(item.type as ActivityType) ? (item.type as ActivityType) : 'ddl'
      const priority = Math.min(3, Math.max(1, Math.round(Number(item.priority) || 2))) as 1 | 2 | 3
      const deadline = normalizeDeadline(item.deadline)
      // 习惯没有截止时间：模型偶尔还是会给 deadline，就把它当成「每天几点」，
      // 别在列表里写成「截止 20:00」——那会让人以为 8 点必须跑完
      const habitClock =
        type === 'habit' ? normalizeClock(item.preferStart) ?? normalizeClock(deadline?.slice(11)) : undefined
      return {
        id: uid(),
        title: String(item.title).trim(),
        type,
        deadline: type === 'habit' ? null : deadline,
        durationMin: Math.max(5, Math.round(Number(item.durationMin) || 60)),
        priority,
        remindBeforeMin: Math.max(0, Math.round(Number(item.remindBeforeMin) || 120)),
        fixed: item.fixed === true,
        preferStart: habitClock,
        note: item.note || '',
        source: 'ai' as const,
        status: 'todo' as const,
      }
    })
}

export function normalizeCourses(raw: RawCourse[]): CourseSlot[] {
  return raw
    .filter(
      (item) =>
        typeof item.name === 'string' && item.name.trim() && typeof item.start === 'string' && typeof item.end === 'string',
    )
    .map((item) => {
      const weekday = Math.min(7, Math.max(1, Math.round(Number(item.weekday) || 1))) as CourseSlot['weekday']
      const start = String(item.start).trim()
      const end = String(item.end).trim()
      return {
        id: uid(),
        name: String(item.name).trim().slice(0, 20),
        weekday,
        start: HHMM.test(start) ? start.padStart(5, '0') : '08:00',
        end: HHMM.test(end) ? end.padStart(5, '0') : '09:40',
      }
    })
    .filter((course) => course.start < course.end)
}
