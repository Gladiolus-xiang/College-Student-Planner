/**
 * 回归：习惯类活动要按原文说的钟点开始，不能默认 19:00 开始、20:00 结束。
 * 起因：输入「晚上8点去跑步」，页面排成 19:00–20:00，看起来像「8 点截止」。
 *
 * 需要 dev server 在跑（会真实调用模型把文字读成 preferStart）：
 * node scripts/smoke-habit.mjs
 */
import { buildParseMessages } from '../src/lib/prompts.ts'
import { planTasks } from '../src/lib/schedule.ts'

let failed = 0
function check(name, ok, extra = '') {
  if (!ok) failed += 1
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
}

const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const today = `${iso}（星期${'日一二三四五六'[now.getDay()]}）`

// 1. 模型层：文字里说了「晚上8点」，要落到 preferStart
const SAMPLE = '每天晚上8点去跑步。'
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

check('拆成习惯类', item.type === 'habit', String(item.type))
check('习惯没有截止时间', item.deadline === null, String(item.deadline))
check('钟点落到 preferStart=20:00', item.preferStart === '20:00', String(item.preferStart))

const activity = {
  id: 'h1',
  title: item.title ?? '跑步',
  type: 'habit',
  deadline: null,
  durationMin: item.durationMin ?? 60,
  priority: 2,
  remindBeforeMin: 60,
  preferStart: item.preferStart ?? '20:00',
  source: 'ai',
  status: 'todo',
}

// 2. 排期层：从 20:00 开始，而不是 19:00 开始、20:00 结束
const blocks = planTasks([activity], [], { days: 1 })
const block = blocks.find((b) => b.activityId === 'h1')
check('排期从 20:00 开始', block?.start === '20:00', block ? `${block.start}-${block.end}` : '没有排上')
check('按 60 分钟占位，结束不早于 21:00', Boolean(block) && block.end >= '21:00', block?.end ?? '')

// 3. 没说钟点的习惯仍然默认晚饭后（19:00），不能因为加了字段就消失
{
  const noClock = { ...activity, id: 'h2', preferStart: undefined }
  const b = planTasks([noClock], [], { days: 1 }).find((x) => x.activityId === 'h2')
  check('没给钟点默认 19:00 开始', b?.start === '19:00', b ? `${b.start}-${b.end}` : '没有排上')
}

// 4. 20:00 被固定日程占了：顺延到更晚，不许挪到 20:00 之前，也不许悄无声息丢掉
{
  const busy = {
    id: 'f1',
    title: '班会',
    type: 'ddl',
    deadline: `${iso} 20:10`,
    durationMin: 30,
    priority: 1,
    remindBeforeMin: 60,
    fixed: true,
    source: 'ai',
    status: 'todo',
  }
  const out = planTasks([activity, busy], [], { days: 1 })
  const h = out.find((b) => b.activityId === 'h1')
  check('钟点被占时仍排上（不丢）', Boolean(h), h ? `${h.start}-${h.end}` : '没有排上')
  check('顺延后不早于 20:00', Boolean(h) && h.start >= '20:00', h?.start ?? '')
  check('理由说明顺延', Boolean(h) && h.reason.includes('顺延'), h?.reason ?? '')
}

// 5. 两个习惯不重叠
{
  const other = { ...activity, id: 'h3', title: '背单词', preferStart: '21:00', durationMin: 30 }
  const out = planTasks([activity, other], [], { days: 1 })
  const a = out.find((b) => b.activityId === 'h1')
  const b = out.find((b) => b.activityId === 'h3')
  const overlap = Boolean(a && b) && a.start < b.end && b.start < a.end
  check('两个习惯不重叠', !overlap, a && b ? `${a.start}-${a.end} / ${b.start}-${b.end}` : '有一项没排上')
}

console.log(failed ? `\n${failed} 项失败` : '\n全部通过（9 项）')
process.exit(failed ? 1 : 0)
