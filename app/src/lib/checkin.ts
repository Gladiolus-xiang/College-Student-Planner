import type { Activity } from '../types'
import { dayKey } from './schedule.ts'

/** 今天打过卡没有 */
export function isCheckedToday(activity: Activity, now = new Date()): boolean {
  return (activity.checkins ?? []).includes(dayKey(now))
}

/** 打卡/取消打卡。不改 status，避免习惯从今日计划里消失。 */
export function toggleCheckin(activity: Activity, now = new Date()): Activity {
  const today = dayKey(now)
  const list = activity.checkins ?? []
  const next = list.includes(today) ? list.filter((d) => d !== today) : [...list, today]
  return { ...activity, checkins: next }
}

/** 连续打卡天数：今天没打就从昨天往前数，断一天就停 */
export function streakDays(checkins: string[] = [], now = new Date()): number {
  if (!checkins.length) return 0
  const set = new Set(checkins)
  const cursor = new Date(now)

  if (!set.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)

  let count = 0
  while (set.has(dayKey(cursor))) {
    count += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return count
}
