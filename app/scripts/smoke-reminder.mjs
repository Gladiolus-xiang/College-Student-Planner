/** 打卡与提醒的纯逻辑测试：不碰浏览器 API，直接验证边界 */
import { streakDays, toggleCheckin } from '../src/lib/checkin.ts'
import { findDue, reminderTitle } from '../src/lib/reminder.ts'
import { dayKey } from '../src/lib/schedule.ts'

let failed = 0
function check(name, ok, extra = '') {
  if (!ok) failed += 1
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ` — ${extra}` : ''}`)
}

const now = new Date('2026-11-22T09:00:00')
const daysAgo = (n) => {
  const d = new Date(now)
  d.setDate(now.getDate() - n)
  return dayKey(d)
}

const cases = [
  ['没打过卡', [], 0],
  ['只打了今天', [daysAgo(0)], 1],
  ['今天昨天连续', [daysAgo(0), daysAgo(1)], 2],
  ['昨天断了今天没打', [daysAgo(1), daysAgo(3)], 1],
  ['中间断一天', [daysAgo(0), daysAgo(1), daysAgo(3)], 2],
]

for (const [name, checkins, expect] of cases) {
  const got = streakDays(checkins, now)
  check(`${name}: 期望 ${expect}`, got === expect, `得到 ${got}`)
}

// 打卡开关
const base = { id: 'h1', title: '背单词', type: 'habit', deadline: null, durationMin: 30, priority: 2, remindBeforeMin: 0, source: 'ai', status: 'todo' }
const checked = toggleCheckin(base, now)
const unchecked = toggleCheckin(checked, now)
check('打卡写入', Boolean(checked.checkins?.includes(dayKey(now))))
check('再点一次取消', unchecked.checkins?.length === 0)

// 提醒窗口
const mk = (id, minutesFromNow, lead) => ({
  id,
  title: id,
  type: 'ddl',
  deadline: (() => {
    const d = new Date(now.getTime() + minutesFromNow * 60_000)
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  })(),
  durationMin: 30,
  priority: 2,
  remindBeforeMin: lead,
  source: 'ai',
  status: 'todo',
})

const fired = new Set()
const due = findDue([mk('现在该提醒', 30, 30), mk('还早', 180, 30), mk('过期两小时', -120, 30)], now, fired)
const ids = due.map((d) => d.id)
check('命中当前提醒', ids.includes('现在该提醒'))
check('未到时间不提醒', !ids.includes('还早'))
check('过期两小时不补发', !ids.includes('过期两小时'))

// 补发：20:05 才录一条 20:06 截止的事，提前 2 小时的提醒时刻早就过了
const catchUp = findDue([mk('一分钟后就截止', 1, 120)], now, new Set()).map((d) => d.id)
check('提醒时刻早过了、截止将至 → 补发一次', catchUp.includes('一分钟后就截止'), catchUp.join(',') || '没有补发')

const deadlinePassed = findDue([mk('截止已过', -10, 120)], now, new Set()).map((d) => d.id)
check('截止已过 → 不补发', !deadlinePassed.includes('截止已过'))

const alreadyFired = new Set([`一分钟后就截止@${mk('一分钟后就截止', 1, 120).deadline}`])
check('补发过就不再补', findDue([mk('一分钟后就截止', 1, 120)], now, alreadyFired).length === 0)

// 提醒标题按「离截止还有多久」说，不用那个早就过时的提前量
check('标题说还有 1 分钟', reminderTitle(mk('x', 1, 120), now) === '还有 1 分钟：x', reminderTitle(mk('x', 1, 120), now))
check('标题说已过截止', reminderTitle(mk('x', -3, 120), now).startsWith('已过截止'), reminderTitle(mk('x', -3, 120), now))

console.log(failed ? `\n${failed} 个失败` : '\n全部通过')
process.exit(failed ? 1 : 0)
