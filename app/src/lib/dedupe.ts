/**
 * 去重：同一件事只留一份。
 * 起因是「同一张群通知截图连贴两次」会在计划里出现两条一模一样的内容 —— 排期会把时间减半。
 *
 * 判重口径：标题（去掉空白、书名号、括号后比较）+ 截止时间。
 * 同名但截止不同的，是两件不同的事，都要留（比如两次实验报告）。
 */
import type { Activity, CourseSlot } from '../types'

/** 标题归一：空白全去掉，中英文括号/书名号不算差异，英文忽略大小写 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s\u3000]/g, '')
    .replace(/[《》()（）「」【】[\]]/g, '')
}

export function activityKey(activity: Pick<Activity, 'title' | 'deadline'>): string {
  return `${normalizeTitle(activity.title)}|${activity.deadline ?? ''}`
}

export function courseKey(course: Pick<CourseSlot, 'name' | 'weekday' | 'start' | 'end'>): string {
  return `${normalizeTitle(course.name)}|${course.weekday}|${course.start}|${course.end}`
}

export interface DedupeResult<T> {
  /** 保留的条目：批内去重后，再排除和已有数据重复的 */
  fresh: T[]
  /** 被丢掉的重复条数 */
  skipped: number
}

/** 新读出来的一批 → 去掉批内重复 + 去掉已经在列表里的 */
export function dedupeActivities(incoming: Activity[], existing: Activity[] = []): DedupeResult<Activity> {
  const seen = new Set(existing.map(activityKey))
  const fresh: Activity[] = []
  let skipped = 0

  for (const item of incoming) {
    const key = activityKey(item)
    if (seen.has(key)) {
      skipped += 1
      continue
    }
    seen.add(key)
    fresh.push(item)
  }
  return { fresh, skipped }
}

export function dedupeCourses(incoming: CourseSlot[]): DedupeResult<CourseSlot> {
  const seen = new Set<string>()
  const fresh: CourseSlot[] = []
  let skipped = 0

  for (const course of incoming) {
    const key = courseKey(course)
    if (seen.has(key)) {
      skipped += 1
      continue
    }
    seen.add(key)
    fresh.push(course)
  }
  return { fresh, skipped }
}
