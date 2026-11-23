/** 用真实输入验证解析结果：只有日期的考试不应被标成固定日程 */
import { buildParseMessages } from '../src/lib/prompts.ts'

const TEXT = ['周日晚5:05晚自习', '下周一高数考试', '后天下午2:00有社团培训'].join('\n')

const now = new Date()
const p = (n) => String(n).padStart(2, '0')
const iso = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
const label = `星期${'日一二三四五六'[now.getDay()]}`

const res = await fetch('http://localhost:5173/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: buildParseMessages(TEXT, `${iso}（${label}）`), json: true }),
})
const data = await res.json()
if (!res.ok) {
  console.error(`HTTP ${res.status}`, data)
  process.exit(1)
}

const parsed = JSON.parse(data.content.slice(data.content.indexOf('{'), data.content.lastIndexOf('}') + 1))
console.log(`model=${data.model} ms=${data.ms}`)
for (const a of parsed.activities) {
  console.log(
    `${a.title} | type=${a.type} | deadline=${a.deadline} | fixed=${a.fixed} | ${a.durationMin}min`,
  )
}

const bad = (parsed.activities ?? []).filter((a) => a.fixed && String(a.deadline ?? '').endsWith('23:59'))
console.log(bad.length ? `\n❌ 仍有 ${bad.length} 条“23:59 却标记为固定日程”` : '\n✅ 没有“23:59 假固定日程”')

// 直接跑一遍排期，看看最终计划长什么样
const { planTasks } = await import('../src/lib/schedule.ts')
const { normalizeDeadline } = await import('../src/lib/time.ts')

const items = parsed.activities.map((a, i) => ({
  id: `a${i + 1}`,
  title: a.title,
  type: a.type,
  deadline: normalizeDeadline(a.deadline),
  durationMin: a.durationMin ?? 60,
  priority: a.priority ?? 2,
  remindBeforeMin: a.remindBeforeMin ?? 120,
  fixed: a.fixed === true,
  source: 'ai',
  status: 'todo',
}))

const blocks = planTasks(items, (await import('../src/data/courses.ts')).SAMPLE_COURSES)
console.log('\n最终计划：')
for (const b of blocks) {
  const act = items.find((x) => x.id === b.activityId)
  console.log(`  ${b.date} ${b.start}-${b.end}  ${act?.title}`)
}
