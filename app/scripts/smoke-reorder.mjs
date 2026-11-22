/** P3 重排冒烟测试：验证模型只给顺序、不漏 id、理由说人话 */
import { buildReorderMessages } from '../src/lib/prompts.ts'
import { planTasks } from '../src/lib/schedule.ts'
import { SAMPLE_COURSES } from '../src/data/courses.ts'

const now = new Date()
const p = (n) => String(n).padStart(2, '0')
const d = (offset, hhmm) => {
  const x = new Date(now)
  x.setDate(now.getDate() + offset)
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())} ${hhmm}`
}

const activities = [
  { id: 'a1', title: '《机器学习》实验报告', type: 'ddl', deadline: d(3, '20:00'), durationMin: 180, priority: 1, remindBeforeMin: 120, source: 'ai', status: 'todo' },
  { id: 'a2', title: '社团招新海报文案', type: 'ddl', deadline: d(5, '18:00'), durationMin: 90, priority: 3, remindBeforeMin: 60, source: 'ai', status: 'todo' },
  { id: 'a3', title: '大学物理习题', type: 'ddl', deadline: d(2, '23:59'), durationMin: 60, priority: 2, remindBeforeMin: 120, source: 'ai', status: 'todo' },
]

const blocks = planTasks(activities, SAMPLE_COURSES)
console.log('—— 当前计划 ——')
for (const b of blocks) console.log(`  ${b.date} ${b.start}-${b.end} ${b.activityId}`)

const todo = activities.map((a) => ({ id: a.id, title: a.title, remainingMin: a.durationMin, deadline: a.deadline }))
const iso = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
const label = `星期${'日一二三四五六'[now.getDay()]}`
const t = new Date(now)
t.setDate(now.getDate() + 1)
const tomorrowStr = `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`

const res = await fetch('http://localhost:5173/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: buildReorderMessages({ today: `${iso}（${label}）`, done: ['大学英语作业'], todo, tomorrow: tomorrowStr }),
    json: true,
    temperature: 0.3,
  }),
})
const data = await res.json()
if (!res.ok) {
  console.error(`HTTP ${res.status}:`, data)
  process.exit(1)
}
console.log(`\nmodel=${data.model} ms=${data.ms} tokens=${data.usage?.total_tokens}`)
console.log(data.content)

const parsed = JSON.parse(data.content.slice(data.content.indexOf('{'), data.content.lastIndexOf('}') + 1))
const missing = todo.filter((x) => !parsed.order?.includes(x.id))
console.log(missing.length ? `\n❌ 漏了：${missing.map((m) => m.id).join(', ')}` : '\n✅ 三个 id 都在，没有遗漏')
