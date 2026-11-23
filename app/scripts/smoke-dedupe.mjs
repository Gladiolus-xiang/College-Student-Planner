/**
 * 离线回归：去重口径。
 * 跑法：node scripts/smoke-dedupe.mjs
 */
import { dedupeActivities, dedupeCourses } from '../src/lib/dedupe.ts'

let failed = 0
function check(name, ok, extra = '') {
  if (!ok) failed += 1
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
}

function act(title, deadline = null, type = 'ddl') {
  return {
    id: Math.random().toString(36).slice(2),
    title,
    type,
    deadline,
    durationMin: 60,
    priority: 2,
    remindBeforeMin: 120,
    source: 'ai',
    status: 'todo',
  }
}

// 1. 同一张截图读两遍：第二遍一条都不新增
{
  const first = [act('大学物理实验报告', '2026-11-27 17:00'), act('班会', '2026-11-25 19:30')]
  const again = [act('大学物理实验报告', '2026-11-27 17:00'), act('班会', '2026-11-25 19:30')]
  const { fresh, skipped } = dedupeActivities(again, first)
  check('重复截图不新增', fresh.length === 0 && skipped === 2, `fresh=${fresh.length} skipped=${skipped}`)
}

// 2. 只重复一部分：新的留下，旧的跳过
{
  const existing = [act('实验报告', '2026-11-27 17:00')]
  const incoming = [act('实验报告', '2026-11-27 17:00'), act('四级模拟考', '2026-11-27 14:00')]
  const { fresh, skipped } = dedupeActivities(incoming, existing)
  check('只跳过重复的那条', fresh.length === 1 && fresh[0].title === '四级模拟考' && skipped === 1, `fresh=${fresh.length}`)
}

// 3. 同名但截止不同 = 两件事，都要留
{
  const { fresh } = dedupeActivities([act('实验报告', '2026-11-27 17:00'), act('实验报告', '2026-12-04 17:00')])
  check('同名不同截止都保留', fresh.length === 2, `fresh=${fresh.length}`)
}

// 4. 空白、书名号、括号、大小写不算差异
{
  const { fresh } = dedupeActivities([
    act('《机器学习》实验报告', '2026-11-27 17:00'),
    act(' 机器学习 实验报告', '2026-11-27 17:00'),
    act('machine learning report', null),
    act('Machine Learning Report', null),
  ])
  check('标题写法差异算重复', fresh.length === 2, `fresh=${fresh.length}`)
}

// 5. 同一批里模型自己重复了两次，也只留一份
{
  const { fresh, skipped } = dedupeActivities([act('背50个单词', null, 'habit'), act('背50个单词', null, 'habit')])
  check('批内重复只留一条', fresh.length === 1 && skipped === 1, `fresh=${fresh.length}`)
}

// 6. 课表：同名同节次同时间只留一份，不同节次都留
{
  const course = (weekday, start, end) => ({ id: Math.random().toString(36).slice(2), name: '高等数学', weekday, start, end })
  const { fresh, skipped } = dedupeCourses([course(1, '08:00', '09:40'), course(1, '08:00', '09:40'), course(3, '08:00', '09:40')])
  check('课表去重按节次区分', fresh.length === 2 && skipped === 1, `fresh=${fresh.length}`)
}

console.log(failed ? `\n${failed} 项失败` : '\n全部通过（6 项）')
process.exit(failed ? 1 : 0)
