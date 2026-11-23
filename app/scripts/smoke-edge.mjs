/** 边界回归：23:59 的「假固定日程」、一次性课程活动、过去时间不被排期 */
import { dayKey, planTasks, planWindowDays, toMin } from '../src/lib/schedule.ts'
import { SAMPLE_COURSES } from '../src/data/courses.ts'

const now = new Date()
const p = (n) => String(n).padStart(2, '0')
const d = (offset) => {
  const x = new Date(now)
  x.setDate(now.getDate() + offset)
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`
}

const activities = [
  // 只有日期、没有时刻 → 模型会填 23:59 并可能误标为固定日程
  { id: 'exam', title: '高数考试', type: 'ddl', deadline: `${d(1)} 23:59`, durationMin: 120, priority: 1, remindBeforeMin: 120, fixed: true, source: 'ai', status: 'todo' },
  // 被解析成 course 的一次性活动
  { id: 'club', title: '社团培训', type: 'course', deadline: `${d(2)} 14:00`, durationMin: 60, priority: 2, remindBeforeMin: 60, fixed: true, source: 'ai', status: 'todo' },
  // 每周固定课，没有截止时间 → 不应该被当成任务排
  { id: 'weekly', title: '高等数学（课表）', type: 'course', deadline: null, durationMin: 100, priority: 3, remindBeforeMin: 0, source: 'ai', status: 'todo' },
]

const blocks = planTasks(activities, SAMPLE_COURSES)
const problems = []

for (const b of blocks) {
  if (toMin(b.end) <= toMin(b.start)) {
    problems.push(`时间倒挂：${b.activityId} ${b.date} ${b.start}-${b.end}`)
  }
}

const examBlocks = blocks.filter((b) => b.activityId === 'exam')
if (!examBlocks.length) problems.push('高数考试没有出现在计划里')

const club = blocks.find((b) => b.activityId === 'club')
if (!club) problems.push('社团培训没有出现在计划里')
else if (club.date !== d(2) || club.start !== '14:00') problems.push(`社团培训时间不对：${club.date} ${club.start}-${club.end}`)

if (blocks.some((b) => b.activityId === 'weekly')) problems.push('没有截止时间的周课被当成了任务')

const today = dayKey(now)
const nowMin = Math.floor((now.getHours() * 60 + now.getMinutes()) / 15) * 15
for (const b of blocks.filter((x) => x.date === today)) {
  if (toMin(b.start) < nowMin) problems.push(`排到了已经过去的时间：${b.start}`)
}

console.log('计划：')
for (const b of blocks) console.log(`  ${b.date} ${b.start}-${b.end}  ${b.activityId}`)

// 计划窗口必须覆盖最远的截止日期
const span = planWindowDays(activities, now)
if (span !== 3) problems.push(`窗口应为 3 天（最远截止在后天），实际 ${span}`)

const farItem = [{ id: 'x', title: '下周三的社团培训', type: 'ddl', deadline: `${d(3)} 14:00`, durationMin: 60, priority: 2, remindBeforeMin: 60, fixed: true, source: 'ai', status: 'todo' }]
const farSpan = planWindowDays(farItem, now)
if (farSpan !== 4) problems.push(`窗口应扩展到 4 天，实际 ${farSpan}`)

const farBlocks = planTasks(farItem, SAMPLE_COURSES, { days: farSpan })
if (!farBlocks.some((b) => b.date === d(3))) problems.push('三天后的固定活动没有出现在计划里')

console.log(problems.length ? `\n❌ ${problems.join('\n❌ ')}` : '\n✅ 全部通过')
process.exit(problems.length ? 1 : 0)
