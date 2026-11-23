import type { Activity, CourseSlot } from '../types'

const KEY = 'today-schedule-items-v1'
const COURSE_KEY = 'today-schedule-courses-v1'

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

/** 课表：识别成功后覆盖默认示例课表，刷新后保留 */
export function loadCourses(): CourseSlot[] | null {
  try {
    const raw = localStorage.getItem(COURSE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length ? (parsed as CourseSlot[]) : null
  } catch {
    return null
  }
}

export function saveCourses(courses: CourseSlot[]): void {
  try {
    localStorage.setItem(COURSE_KEY, JSON.stringify(courses))
  } catch {
    // ignore
  }
}
