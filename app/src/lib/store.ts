import type { Activity } from '../types'

const KEY = 'today-schedule-items-v1'

/** 刷新页面不丢数据。隐私模式/无痕窗口写不进去，静默失败即可。 */
export function loadItems(): Activity[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Activity[]) : []
  } catch {
    return []
  }
}

export function saveItems(items: Activity[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // 隐私模式下 localStorage 不可用，不影响本次使用
  }
}

export function clearItems(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
