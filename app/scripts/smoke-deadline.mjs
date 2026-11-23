/**
 * 离线回归：有硬截止的活动不能被排到截止之后。
 * 起因：20:05 录入「今晚 20:06 高数作业截止」，计划排出 20:15–21:15——截止之后才动工。
 *
 * 跑法：node scripts/smoke-deadline.mjs（不联网）
 */
import { planTasks } from '../src/lib/schedule.ts'

let failed = 0
function check(name, ok, extra = '') {
  if (!ok) failed += 1
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
}

const now = new Date()
const p = (n) => String(n).padStart(2, '0')
/** 从今天起第 offset 天的 hh:mm，返回 deadline 字符串 */
const at = (offset, hhmm) => {
  const d = new Date(now)
  d.setDate(now.getDate() + offset)
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${hhmm}`
}
const todayKey = at(0, '00:00').slice(0, 10)
const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

const task = (id, deadline, durationMin = 60, priority = 1) => ({
  id,
  title: id,
  type: 'ddl',
  deadline,
  durationMin,
  priority,
  remindBeforeMin: 120,
  source: 'ai',
  status: 'todo',
})

// 1. 今天的截止已经过了：不许排出「截止之后」的块
{
  const minutesLeft = 1
  const soon = new Date(now.getTime() + minutesLeft * 60_000)
  const deadline = `${todayKey} ${p(soon.getHours())}:${p(soon.getMinutes())}`
  const blocks = planTasks([task('高数作业', deadline)], [], { days: 1 })
  const mine = blocks.filter((b) => b.activityId === '高数作业')
  check('截止只剩 1 分钟时不排块', mine.length === 0, mine.map((b) => `${b.start}-${b.end}`).join(', ') || '没有块')
}

// 2. 截止在今晚稍后：排出来的块必须在截止前结束，且不越界到 21:00 之后
{
  const deadline = at(0, '21:00')
  const blocks = planTasks([task('机器学习报告', deadline, 180)], [], { days: 1 })
  const mine = blocks.filter((b) => b.activityId === '机器学习报告')
  const allBefore = mine.every((b) => minutesOf(b.end) <= minutesOf('21:00'))
  check('块在截止前结束', mine.length > 0 && allBefore, mine.map((b) => `${b.start}-${b.end}`).join(', ') || '没有块')
}

// 3. 明天 14:00 截止的长任务：今天可以先做，明天那块必须在 14:00 前收尾
{
  const deadline = at(1, '14:00')
  const blocks = planTasks([task('实验报告', deadline, 240)], [], { days: 2 })
  const mine = blocks.filter((b) => b.activityId === '实验报告')
  const tomorrowKey = at(1, '00:00').slice(0, 10)
  const tomorrowBlocks = mine.filter((b) => b.date === tomorrowKey)
  check(
    '截止当天最后一块在 14:00 前结束',
    mine.length > 0 && tomorrowBlocks.every((b) => minutesOf(b.end) <= minutesOf('14:00')),
    mine.map((b) => `${b.date.slice(5)} ${b.start}-${b.end}`).join(', ') || '没有块',
  )
}

// 4. 跨天的长任务：昨天那块不受明天的截止影响，但最后必须赶在截止前
{
  const deadline = at(2, '12:00')
  const blocks = planTasks([task('课程设计', deadline, 300)], [], { days: 3 })
  const mine = blocks.filter((b) => b.activityId === '课程设计')
  const last = mine[mine.length - 1]
  check('跨天任务最后一块不晚于截止', Boolean(last) && minutesOf(last.end) <= minutesOf('12:00'), last ? `${last.date} ${last.start}-${last.end}` : '没有块')
}

// 5. 截止已经过了好几天：不再往后排（交给「没排上」列表说明）
{
  const blocks = planTasks([task('过期作业', at(-1, '18:00'))], [], { days: 1 })
  const mine = blocks.filter((b) => b.activityId === '过期作业')
  check('过期的任务不排进计划', mine.length === 0, mine.map((b) => `${b.start}-${b.end}`).join(', ') || '没有块')
}

// 6. 没有截止时间的任务不受影响
{
  const blocks = planTasks([task('无截止', null)], [], { days: 1 })
  check('没有截止时间的照常排', blocks.some((b) => b.activityId === '无截止'))
}

console.log(failed ? `\n${failed} 项失败` : '\n全部通过（6 项）')
process.exit(failed ? 1 : 0)
