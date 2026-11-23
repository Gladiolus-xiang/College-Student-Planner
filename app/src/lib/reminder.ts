import { parseDeadline } from './time.ts'
import type { Activity } from '../types'

/** 该提醒的时刻 = 截止时间 - 提前量 */
export function reminderAt(activity: Activity): Date | null {
  const due = parseDeadline(activity.deadline)
  if (!due) return null
  return new Date(due.getTime() - Math.max(0, activity.remindBeforeMin || 0) * 60_000)
}

export function reminderKey(activity: Activity): string {
  return `${activity.id}@${activity.deadline}`
}

/** 补发窗口：提醒时刻错过后，只要截止还剩这么久，就立刻补一条「快到点了」 */
const CATCH_UP_MIN = 30

/**
 * 找出「现在该提醒」的活动。
 * 两种情况：① 提醒时刻刚过（30 分钟内）；② 提醒时刻早就过了，但截止只剩 30 分钟以内
 * —— 后者是「20:05 才录一条 20:06 截止的事」，提前两小时的提醒时刻早就过去了，
 * 不补发的话页面一声不响，用户只能自己盯着表。
 */
export function findDue(items: Activity[], now: Date, fired: Set<string>): Activity[] {
  return items.filter((activity) => {
    const at = reminderAt(activity)
    if (!at) return false
    if (fired.has(reminderKey(activity))) return false

    const lateMin = (now.getTime() - at.getTime()) / 60_000
    if (lateMin < 0) return false
    if (lateMin <= CATCH_UP_MIN) return true

    const due = parseDeadline(activity.deadline)
    if (!due) return false
    const leftMin = (due.getTime() - now.getTime()) / 60_000
    return leftMin > 0 && leftMin <= CATCH_UP_MIN
  })
}

/** 提醒标题：按「离截止还有多久」说人话，不用那个可能早就过时的提前量 */
export function reminderTitle(activity: Activity, now: Date): string {
  const due = parseDeadline(activity.deadline)
  if (!due) return activity.title

  const left = Math.round((due.getTime() - now.getTime()) / 60_000)
  if (left <= 0) return `已过截止：${activity.title}`
  if (left < 60) return `还有 ${left} 分钟：${activity.title}`

  const hours = Math.floor(left / 60)
  const minutes = left % 60
  return minutes ? `还有 ${hours} 小时 ${minutes} 分钟：${activity.title}` : `还有 ${hours} 小时：${activity.title}`
}

/** 第一次真的该提醒时才申请权限：不给权限也能用，只是改成页面内卡片 */
export async function ensureNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'default') return Notification.requestPermission()
  return Notification.permission
}

/** 系统通知：页面在后台也能看到。失败不抛异常，页面内的 Toast 仍然有效。 */
export function systemNotify(title: string, body: string): boolean {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
  try {
    new Notification(title, { body, icon: '/favicon.svg', tag: title })
    return true
  } catch {
    return false
  }
}
