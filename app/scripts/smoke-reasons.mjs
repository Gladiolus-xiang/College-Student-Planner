/** P2 冒烟测试：真实调用模型，看它给的理由像不像人话（不是「为了更好地管理时间」） */
import { buildReasonMessages } from '../src/lib/prompts.ts'
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
  { id: 'a1', title: '《机器学习》实验报告', type: 'ddl', deadline: d(4, '20:00'), durationMin: 180, priority: 1, remindBeforeMin: 120, source: 'ai', status: 'todo' },
  { id: 'a3', title: '每天背50个单词', type: 'habit', deadline: null, durationMin: 30, priority: 2, remindBeforeMin: 30, source: 'ai', status: 'todo' },
]

const blocks = planTasks(activities, SAMPLE_COURSES)
const seen = new Set()
const payload = blocks
  .filter((b) => (seen.has(b.activityId) ? false : seen.add(b.activityId)))
  .map((b) => ({
    activityId: b.activityId,
    title: activities.find((a) => a.id === b.activityId)?.title ?? '',
    date: b.date,
    start: b.start,
    end: b.end,
    deadline: activities.find((a) => a.id === b.activityId)?.deadline ?? null,
  }))

const iso = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
const label = `星期${'日一二三四五六'[now.getDay()]}`

const res = await fetch('http://localhost:5173/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: buildReasonMessages(payload, `${iso}（${label}）`), json: true, temperature: 0.6 }),
})
const data = await res.json()
if (!res.ok) {
  console.error(`HTTP ${res.status}:`, data)
  process.exit(1)
}
console.log(`model=${data.model} ms=${data.ms} tokens=${data.usage?.total_tokens}`)
console.log(data.content)
