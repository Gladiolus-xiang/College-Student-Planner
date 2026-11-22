/** 打卡与提醒的纯逻辑测试：不碰浏览器 API，直接验证边界 */
import { streakDays, toggleCheckin } from '../src/lib/checkin.ts'
import { findDue } from '../src/lib/reminder.ts'
import { dayKey } from '../src/lib/schedule.ts'

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

let failed = 0
for (const [name, checkins, expect] of cases) {
  const got = streakDays(checkins, now)
  const ok = got === expect
  if (!ok) failed += 1
  console.log(`${ok ? '✅' : '❌'} ${name}: 期望 ${expect}，得到 ${got}`)
}

// 打卡开关
const base = { id: 'h1', title: '背单词', type: 'habit', deadline: null, durationMin: 30, priority: 2, remindBeforeMin: 0, source: 'ai', status: 'todo' }
const checked = toggleCheckin(base, now)
const unchecked = toggleCheckin(checked, now)
console.log(`${checked.checkins?.includes(dayKey(now)) ? '✅' : '❌'} 打卡写入`)
console.log(`${unchecked.checkins?.length === 0 ? '✅' : '❌'} 再点一次取消`)

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
console.log(`${ids.includes('现在该提醒') ? '✅' : '❌'} 命中当前提醒`)
console.log(`${ids.includes('还早') ? '❌' : '✅'} 未到时间不提醒`)
console.log(`${ids.includes('过期两小时') ? '❌' : '✅'} 过期太久不补发`)

console.log(failed ? `\n${failed} 个失败` : '\n全部通过')
