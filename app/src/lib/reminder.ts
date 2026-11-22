import type { Activity } from '../types'

/** 该提醒的时刻 = 截止时间 - 提前量 */
export function reminderAt(activity: Activity): Date | null {
  if (!activity.deadline) return null
  const due = new Date(activity.deadline.replace(' ', 'T'))
  if (Number.isNaN(due.getTime())) return null
  return new Date(due.getTime() - Math.max(0, activity.remindBeforeMin || 0) * 60_000)
}

export function reminderKey(activity: Activity): string {
  return `${activity.id}@${activity.deadline}`
}

/**
 * 找出「现在该提醒」的活动。
 * 只补发最近 30 分钟内的，避免一打开页面就炸出一堆几天前的过期提醒。
 */
export function findDue(items: Activity[], now: Date, fired: Set<string>): Activity[] {
  return items.filter((activity) => {
    const at = reminderAt(activity)
    if (!at) return false
    const diff = now.getTime() - at.getTime()
    if (diff < 0 || diff > 30 * 60_000) return false
    return !fired.has(reminderKey(activity))
  })
}

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
