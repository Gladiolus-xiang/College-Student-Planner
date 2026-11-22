export type ActivityType = 'ddl' | 'habit' | 'course' | 'goal'

export interface Activity {
  id: string
  title: string
  type: ActivityType
  /** YYYY-MM-DD HH:mm，没有截止时间就是 null */
  deadline: string | null
  durationMin: number
  priority: 1 | 2 | 3
  remindBeforeMin: number
  /** 固定日程（考试、上课、面试）：只占时间，不需要再安排准备工作 */
  fixed?: boolean
  note?: string
  source: 'ai' | 'manual'
  status: 'todo' | 'done'
  /** 习惯类任务的打卡日期，YYYY-MM-DD */
  checkins?: string[]
}

export interface CourseSlot {
  id: string
  name: string
  /** 1 = 周一 */
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7
  start: string
  end: string
}

export interface PlanBlock {
  date: string
  activityId: string
  start: string
  end: string
  reason: string
}

export const TYPE_META: Record<ActivityType, { label: string; accent: string; chip: string }> = {
  ddl: { label: 'DDL', accent: 'border-rose-400', chip: 'bg-rose-50 text-rose-700' },
  habit: { label: '习惯', accent: 'border-emerald-400', chip: 'bg-emerald-50 text-emerald-700' },
  course: { label: '课程', accent: 'border-sky-400', chip: 'bg-sky-50 text-sky-700' },
  goal: { label: '目标', accent: 'border-violet-400', chip: 'bg-violet-50 text-violet-700' },
}
