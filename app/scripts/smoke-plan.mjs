/** 排期引擎冒烟测试：不经过模型，直接验证规则排期是否排出合法、不冲突的时段 */
import { groupByDay, planTasks } from '../src/lib/schedule.ts'
import { SAMPLE_COURSES } from '../src/data/courses.ts'

const now = new Date()
const p = (n) => String(n).padStart(2, '0')
const d = (offset, hhmm) => {
  const x = new Date(now)
  x.setDate(now.getDate() + offset)
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())} ${hhmm}`
}

const activities = [
  { id: 'a1', title: '《机器学习》实验报告', type: 'ddl', deadline: d(4, '20:00'), durationMin: 180, priority: 1, remindBeforeMin: 120, source: 'ai', status: 'todo' },
  { id: 'a2', title: '英语四级模拟考', type: 'ddl', deadline: d(6, '14:00'), durationMin: 120, priority: 2, remindBeforeMin: 120, fixed: true, source: 'ai', status: 'todo' },
  { id: 'a3', title: '每天背50个单词', type: 'habit', deadline: null, durationMin: 30, priority: 2, remindBeforeMin: 30, source: 'ai', status: 'todo' },
  { id: 'a4', title: '四级正式考试', type: 'goal', deadline: d(21, '09:00'), durationMin: 120, priority: 1, remindBeforeMin: 120, fixed: true, source: 'ai', status: 'todo' },
]

function check(label, blocks) {
  const days = groupByDay(blocks, activities)
  console.log(`\n=== ${label} ===`)
  for (const day of days) {
    console.log(`${day.date} ${day.weekday}`)
    for (const b of day.blocks) {
      console.log(`  ${b.start}-${b.end}  ${b.activity?.title}  (${b.reason})`)
    }
  }

  let problems = 0
  for (const day of days) {
    const sorted = [...day.blocks].sort((a, b) => a.start.localeCompare(b.start))
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].start < sorted[i - 1].end) {
        console.log(`❌ 重叠：${day.date} ${sorted[i - 1].start}-${sorted[i - 1].end} 与 ${sorted[i].start}-${sorted[i].end}`)
        problems += 1
      }
    }
  }
  console.log(problems ? `${problems} 个问题` : '✅ 无重叠、无课程冲突')
  return problems
}

let problems = check('首次排期', planTasks(activities, SAMPLE_COURSES))

// 重排场景：从明天开始，按模型给的顺序 + 剩余时长
const start = new Date(now)
start.setDate(now.getDate() + 1)
problems += check(
  '重排：从明天起，顺序 a2 → a1',
  planTasks(activities, SAMPLE_COURSES, {
    from: start,
    order: ['a2', 'a1'],
    remainingMin: { a1: 120, a3: 30, a4: 120 },
  }),
)

process.exit(problems ? 1 : 0)
