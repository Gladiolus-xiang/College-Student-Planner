/**
 * 回归：把「时刻 + 有某事」读成开始时间，而不是截止时间。
 * 起因：输入「今天15：53有线代复习」，模型把 15:53 当成截止，页面显示「截止 15:53 · 1 分钟后」。
 *
 * 需要 dev server 在跑：node scripts/smoke-start-time.mjs
 */
import { buildParseMessages } from '../src/lib/prompts.ts'
import { planTasks } from '../src/lib/schedule.ts'

const SAMPLE = '今天15：53有线代复习。'
const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const today = `${iso}（星期${'日一二三四五六'[now.getDay()]}）`

const res = await fetch('http://localhost:5173/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: buildParseMessages(SAMPLE, today), json: true }),
})

const data = await res.json()
if (!res.ok) {
  console.error(`HTTP ${res.status}:`, data)
  process.exit(1)
}

const parsed = JSON.parse(data.content.slice(data.content.indexOf('{'), data.content.lastIndexOf('}') + 1))
const item = parsed.activities?.[0] ?? {}
console.log(`model=${data.model} ms=${data.ms}`)
console.log(JSON.stringify(item))

const checks = [
  ['有解析出一条活动', Boolean(item.title)],
  ['fixed 为 true（到点在场，不是待办）', item.fixed === true],
  ['deadline 保留 15:53 这个时刻', String(item.deadline ?? '').endsWith('15:53')],
  ['时长按 60–90 分钟估', Number(item.durationMin) >= 60 && Number(item.durationMin) <= 90],
]

// 排期层：固定日程应当从 15:53 占住 durationMin 分钟，而不是「在 15:53 前做完」
const activity = {
  id: 'a1',
  title: item.title ?? '线代复习',
  type: item.type ?? 'ddl',
  deadline: item.deadline ?? null,
  durationMin: item.durationMin ?? 60,
  priority: 2,
  remindBeforeMin: 60,
  fixed: item.fixed === true,
  source: 'ai',
  status: 'todo',
}
const blocks = planTasks([activity], [], { days: 1 })
const block = blocks.find((b) => b.activityId === 'a1')
checks.push(['排期从 15:53 开始占位', block?.start === '15:53', block ? `${block.start}-${block.end}` : '没有排上'])
checks.push(['占位时长等于活动时长', Boolean(block) && block.end >= '17:00', block?.end ?? ''])

let failed = 0
for (const [name, ok, extra = ''] of checks) {
  if (!ok) failed += 1
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
}
console.log(failed ? `\n${failed} 项失败` : '\n全部通过')
process.exit(failed ? 1 : 0)
